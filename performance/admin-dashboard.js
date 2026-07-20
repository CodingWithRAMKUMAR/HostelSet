import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SUPABASE_URL = (__ENV.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = __ENV.K6_ADMIN_PASSWORD || '';

const loginDuration = new Trend('admin_login_duration', true);
const serverSessionDuration = new Trend('admin_server_session_duration', true);
const dashboardPageDuration = new Trend('admin_dashboard_page_duration', true);
const overviewResourcesDuration = new Trend('admin_overview_resources_duration', true);

export const options = {
  scenarios: {
    admin_dashboard_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    admin_login_duration: ['p(95)<2000'],
    admin_server_session_duration: ['p(95)<2000'],
    admin_dashboard_page_duration: ['p(95)<2000'],
    admin_overview_resources_duration: ['p(95)<3000'],
    'http_req_duration{endpoint:admin_dashboard_stats}': ['p(95)<2000'],
  },
};

function supabaseHeaders(accessToken = '') {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function responseJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function isJsonArray(response) {
  return Array.isArray(responseJson(response, null));
}

function encoded(value) {
  return encodeURIComponent(value);
}

function restGet(path, accessToken, endpoint) {
  return {
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/${path}`,
    params: {
      headers: supabaseHeaders(accessToken),
      timeout: '15s',
      tags: { endpoint },
    },
  };
}

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fail('Missing K6_ADMIN_EMAIL or K6_ADMIN_PASSWORD.');
  }

  return { ready: true };
}

export default function () {
  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
    {
      headers: supabaseHeaders(),
      timeout: '15s',
      tags: { endpoint: 'admin_login' },
    },
  );

  loginDuration.add(loginResponse.timings.duration);

  const loginBody = responseJson(loginResponse, {});
  const accessToken = loginBody?.access_token || '';
  const refreshToken = loginBody?.refresh_token || '';
  const userId = loginBody?.user?.id || '';

  check(loginResponse, {
    'Admin login connection succeeded': response => response.status !== 0,
    'Admin login status is 200': response => response.status === 200,
  });

  check(loginBody, {
    'Admin access token exists': body => Boolean(body?.access_token),
    'Admin refresh token exists': body => Boolean(body?.refresh_token),
    'Admin authenticated user ID exists': body => Boolean(body?.user?.id),
  });

  if (!accessToken || !refreshToken || !userId) {
    fail(`Admin login failed with HTTP ${loginResponse.status}.`);
  }

  const authHeaders = supabaseHeaders(accessToken);

  const userResponse = http.get(
    `${SUPABASE_URL}/rest/v1/users?select=id%2Crole%2Cis_active&id=eq.${encoded(userId)}&limit=1`,
    {
      headers: authHeaders,
      timeout: '15s',
      tags: { endpoint: 'admin_user_role' },
    },
  );

  const userRows = responseJson(userResponse, []);
  const userProfile = Array.isArray(userRows) ? userRows[0] : null;

  check(userResponse, {
    'Admin user query status is 200': response => response.status === 200,
  });

  check(userProfile, {
    'User is an active admin': profile =>
      profile?.role === 'admin' && profile?.is_active !== false,
  });

  if (
    !userProfile ||
    userProfile.role !== 'admin' ||
    userProfile.is_active === false
  ) {
    fail('The supplied account is not an active admin.');
  }

  const sessionResponse = http.post(
    `${BASE_URL}/api/auth/session`,
    JSON.stringify({ refreshToken }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      redirects: 0,
      tags: { endpoint: 'admin_server_session' },
    },
  );

  serverSessionDuration.add(sessionResponse.timings.duration);

  check(sessionResponse, {
    'Admin server session connection succeeded': response =>
      response.status !== 0,
    'Admin server session was created': response => response.status === 204,
  });

  if (sessionResponse.status !== 204) {
    fail(`Admin server session failed with HTTP ${sessionResponse.status}.`);
  }

  const dashboardResponse = http.get(`${BASE_URL}/admin/dashboard`, {
    timeout: '15s',
    redirects: 0,
    tags: { endpoint: 'admin_dashboard_page' },
  });

  dashboardPageDuration.add(dashboardResponse.timings.duration);

  check(dashboardResponse, {
    'Admin dashboard status is 200': response => response.status === 200,
    'Admin dashboard did not redirect to login': response =>
      ![301, 302, 303, 307, 308].includes(response.status),
    'Admin dashboard body exists': response =>
      typeof response.body === 'string' && response.body.length > 100,
  });

  if (dashboardResponse.status !== 200) {
    fail(`Admin dashboard failed with HTTP ${dashboardResponse.status}.`);
  }

  const paymentSelect = encoded(
    '*,tenants(name,phone,room_id,rooms(room_number))',
  );

  const preBookingSelect = encoded(
    '*,rooms(room_number,monthly_rent,capacity,current_occupants,has_approved_prebooking,property_id,properties(name))',
  );

  const applicationSelect = encoded(
    '*,rooms(room_number,monthly_rent,property_id)',
  );

  const complaintSelect = encoded('*,tenants(name,phone)');

  const vacateSelect = encoded(
    '*,tenants(name,phone,room_id,rooms(room_number))',
  );

  const roomChangeSelect = encoded(
    '*,tenants(name,phone),old_room:old_room_id(room_number),new_room:new_room_id(room_number)',
  );

  const membershipOwnerSelect = encoded(
    'id,full_name,email,phone,is_active,properties!properties_owner_id_fkey(id,name,membership_active,membership_expiry)',
  );

  const membershipRequestSelect = encoded(
    [
      'id',
      'owner_id',
      'property_id',
      'plan_id',
      'amount',
      'status',
      'requested_at',
      'reviewed_at',
      'reviewed_by',
      'admin_note',
      'owner:users!membership_requests_owner_id_fkey(id,full_name,email,phone,is_active)',
      'property:properties!membership_requests_property_id_fkey(id,name,address,city,lifecycle_status,archived_at)',
    ].join(','),
  );

  const resourcesStartedAt = Date.now();

  const resources = http.batch([
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_stats`,
      body: '{}',
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'admin_dashboard_stats' },
      },
    },
    restGet(
      `payment_history?select=${paymentSelect}&order=payment_date.desc`,
      accessToken,
      'admin_payments',
    ),
    restGet(
      `pre_bookings?select=${preBookingSelect}&status=in.(pending,reserved,converted)&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_prebookings',
    ),
    restGet(
      `applications?select=${applicationSelect}&status=eq.pending&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_applications',
    ),
    restGet(
      `complaints?select=${complaintSelect}&order=created_at.desc`,
      accessToken,
      'admin_complaints',
    ),
    restGet(
      `check_out_requests?select=${vacateSelect}&order=created_at.desc`,
      accessToken,
      'admin_vacates',
    ),
    restGet(
      `room_change_requests?select=${roomChangeSelect}&order=requested_at.desc`,
      accessToken,
      'admin_room_changes',
    ),
    restGet(
      'notices?select=*&order=created_at.desc',
      accessToken,
      'admin_notices',
    ),
    restGet(
      `users?select=${membershipOwnerSelect}&role=eq.owner&order=created_at.desc`,
      accessToken,
      'admin_membership_owners',
    ),
    restGet(
      `membership_requests?select=${membershipRequestSelect}&status=eq.pending&order=requested_at.asc`,
      accessToken,
      'admin_membership_requests',
    ),
    restGet(
      `notifications?select=*&recipient_user_id=eq.${encoded(userId)}&order=created_at.desc&offset=0&limit=30`,
      accessToken,
      'admin_notifications',
    ),
  ]);

  overviewResourcesDuration.add(Date.now() - resourcesStartedAt);

  const [
    stats,
    payments,
    preBookings,
    applications,
    complaints,
    vacates,
    roomChanges,
    notices,
    membershipOwners,
    membershipRequests,
    notifications,
  ] = resources;

  const statsBody = responseJson(stats, null);

  check(stats, {
    'Admin dashboard stats status is 200': response => response.status === 200,
  });

  check(statsBody, {
    'Admin dashboard stats returned an object': body =>
      Boolean(body) && typeof body === 'object' && !Array.isArray(body),
    'Admin dashboard stats include total properties': body =>
      Number.isFinite(Number(body?.totalProperties)),
    'Admin dashboard stats include total tenants': body =>
      Number.isFinite(Number(body?.totalTenants)),
  });

  check(payments, {
    'Admin payments status is 200': response => response.status === 200,
    'Admin payments returned an array': isJsonArray,
  });

  check(preBookings, {
    'Admin pre-bookings status is 200': response => response.status === 200,
    'Admin pre-bookings returned an array': isJsonArray,
  });

  check(applications, {
    'Admin applications status is 200': response => response.status === 200,
    'Admin applications returned an array': isJsonArray,
  });

  check(complaints, {
    'Admin complaints status is 200': response => response.status === 200,
    'Admin complaints returned an array': isJsonArray,
  });

  check(vacates, {
    'Admin vacate requests status is 200': response => response.status === 200,
    'Admin vacate requests returned an array': isJsonArray,
  });

  check(roomChanges, {
    'Admin room changes status is 200': response => response.status === 200,
    'Admin room changes returned an array': isJsonArray,
  });

  check(notices, {
    'Admin notices status is 200': response => response.status === 200,
    'Admin notices returned an array': isJsonArray,
  });

  check(membershipOwners, {
    'Admin membership owners status is 200': response => response.status === 200,
    'Admin membership owners returned an array': isJsonArray,
  });

  check(membershipRequests, {
    'Admin membership requests status is 200': response =>
      response.status === 200,
    'Admin membership requests returned an array': isJsonArray,
  });

  check(notifications, {
    'Admin notifications status is 200': response => response.status === 200,
    'Admin notifications returned an array': isJsonArray,
  });

  const localLogoutResponse = http.del(
    `${BASE_URL}/api/auth/session`,
    null,
    {
      timeout: '15s',
      redirects: 0,
      tags: { endpoint: 'admin_local_logout' },
    },
  );

  check(localLogoutResponse, {
    'Admin local session was cleared': response => response.status === 204,
  });

  const supabaseLogoutResponse = http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: authHeaders,
      timeout: '15s',
      tags: { endpoint: 'admin_supabase_local_logout' },
    },
  );

  check(supabaseLogoutResponse, {
    'Admin Supabase local session was cleared': response =>
      [200, 204].includes(response.status),
  });
}