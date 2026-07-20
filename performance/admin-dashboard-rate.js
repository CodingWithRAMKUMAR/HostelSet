import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SUPABASE_URL = (__ENV.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = __ENV.K6_ADMIN_PASSWORD || '';

const journeyDuration = new Trend('admin_steady_journey_duration', true);
const resourcesDuration = new Trend('admin_steady_resources_duration', true);

export const options = {
  scenarios: {
    admin_dashboard_steady_rate: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },

  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],

    'http_req_failed{test_scope:admin_steady_workload}': [
      'rate<0.01',
    ],

    'http_req_duration{endpoint:admin_steady_page}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:admin_steady_stats}': [
      'p(95)<1000',
    ],

    admin_steady_resources_duration: [
      'p(95)<3000',
    ],

    admin_steady_journey_duration: [
      'p(95)<4000',
    ],
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
      tags: {
        endpoint,
        test_scope: 'admin_steady_workload',
      },
    },
  };
}

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fail('Missing K6_ADMIN_EMAIL or K6_ADMIN_PASSWORD.');
  }

  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
    {
      headers: supabaseHeaders(),
      timeout: '15s',
      tags: {
        endpoint: 'admin_steady_setup_login',
      },
    },
  );

  const loginBody = responseJson(loginResponse, {});
  const accessToken = loginBody?.access_token || '';
  const refreshToken = loginBody?.refresh_token || '';
  const userId = loginBody?.user?.id || '';

  if (
    loginResponse.status !== 200 ||
    !accessToken ||
    !refreshToken ||
    !userId
  ) {
    fail(
      `Admin setup login failed with HTTP ${loginResponse.status}.`,
    );
  }

  const roleResponse = http.get(
    `${SUPABASE_URL}/rest/v1/users?select=id%2Crole%2Cis_active&id=eq.${encoded(userId)}&limit=1`,
    {
      headers: supabaseHeaders(accessToken),
      timeout: '15s',
      tags: {
        endpoint: 'admin_steady_setup_role',
      },
    },
  );

  const roleRows = responseJson(roleResponse, []);
  const profile = Array.isArray(roleRows)
    ? roleRows[0]
    : null;

  if (
    roleResponse.status !== 200 ||
    profile?.role !== 'admin' ||
    profile?.is_active === false
  ) {
    fail('The supplied account is not an active admin.');
  }

  return {
    accessToken,
    refreshToken,
    userId,
  };
}

export default function (data) {
  const journeyStartedAt = Date.now();

  const accessToken = data.accessToken;
  const refreshToken = data.refreshToken;
  const userId = data.userId;
  const authHeaders = supabaseHeaders(accessToken);

  const cookieHeader = [
    `hostelset_access_token=${encodeURIComponent(accessToken)}`,
    `hostelset_refresh_token=${encodeURIComponent(refreshToken)}`,
  ].join('; ');

  const pageResponse = http.get(
    `${BASE_URL}/admin/dashboard`,
    {
      headers: {
        Cookie: cookieHeader,
      },
      timeout: '15s',
      redirects: 0,
      tags: {
        endpoint: 'admin_steady_page',
        test_scope: 'admin_steady_workload',
      },
    },
  );

  check(pageResponse, {
    'Steady admin page status is 200': response =>
      response.status === 200,

    'Steady admin page did not redirect': response =>
      ![301, 302, 303, 307, 308].includes(response.status),

    'Steady admin page body exists': response =>
      typeof response.body === 'string' &&
      response.body.length > 100,
  });

  const paymentSelect = encoded(
    '*,tenants(name,phone,room_id,rooms(room_number))',
  );

  const preBookingSelect = encoded(
    '*,rooms(room_number,monthly_rent,capacity,current_occupants,has_approved_prebooking,property_id,properties(name))',
  );

  const applicationSelect = encoded(
    '*,rooms(room_number,monthly_rent,property_id)',
  );

  const complaintSelect = encoded(
    '*,tenants(name,phone)',
  );

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

  const responses = http.batch([
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_stats`,
      body: '{}',
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'admin_steady_stats',
          test_scope: 'admin_steady_workload',
        },
      },
    },

    restGet(
      `payment_history?select=${paymentSelect}&order=payment_date.desc`,
      accessToken,
      'admin_steady_payments',
    ),

    restGet(
      `pre_bookings?select=${preBookingSelect}&status=in.(pending,reserved,converted)&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_steady_prebookings',
    ),

    restGet(
      `applications?select=${applicationSelect}&status=eq.pending&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_steady_applications',
    ),

    restGet(
      `complaints?select=${complaintSelect}&order=created_at.desc`,
      accessToken,
      'admin_steady_complaints',
    ),

    restGet(
      `check_out_requests?select=${vacateSelect}&order=created_at.desc`,
      accessToken,
      'admin_steady_vacates',
    ),

    restGet(
      `room_change_requests?select=${roomChangeSelect}&order=requested_at.desc`,
      accessToken,
      'admin_steady_room_changes',
    ),

    restGet(
      'notices?select=*&order=created_at.desc',
      accessToken,
      'admin_steady_notices',
    ),

    restGet(
      `users?select=${membershipOwnerSelect}&role=eq.owner&order=created_at.desc`,
      accessToken,
      'admin_steady_membership_owners',
    ),

    restGet(
      `membership_requests?select=${membershipRequestSelect}&status=eq.pending&order=requested_at.asc`,
      accessToken,
      'admin_steady_membership_requests',
    ),

    restGet(
      `notifications?select=*&recipient_user_id=eq.${encoded(userId)}&order=created_at.desc&offset=0&limit=30`,
      accessToken,
      'admin_steady_notifications',
    ),
  ]);

  resourcesDuration.add(
    Date.now() - resourcesStartedAt,
  );

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
  ] = responses;

  const statsBody = responseJson(stats, null);

  check(stats, {
    'Steady admin stats status is 200': response =>
      response.status === 200,
  });

  check(statsBody, {
    'Steady admin stats returned an object': body =>
      Boolean(body) &&
      typeof body === 'object' &&
      !Array.isArray(body),

    'Steady admin stats include totals': body =>
      Number.isFinite(Number(body?.totalProperties)) &&
      Number.isFinite(Number(body?.totalTenants)),
  });

  check(payments, {
    'Steady admin payments status is 200': response =>
      response.status === 200,

    'Steady admin payments returned an array':
      isJsonArray,
  });

  check(preBookings, {
    'Steady admin pre-bookings status is 200': response =>
      response.status === 200,

    'Steady admin pre-bookings returned an array':
      isJsonArray,
  });

  check(applications, {
    'Steady admin applications status is 200': response =>
      response.status === 200,

    'Steady admin applications returned an array':
      isJsonArray,
  });

  check(complaints, {
    'Steady admin complaints status is 200': response =>
      response.status === 200,

    'Steady admin complaints returned an array':
      isJsonArray,
  });

  check(vacates, {
    'Steady admin vacates status is 200': response =>
      response.status === 200,

    'Steady admin vacates returned an array':
      isJsonArray,
  });

  check(roomChanges, {
    'Steady admin room changes status is 200': response =>
      response.status === 200,

    'Steady admin room changes returned an array':
      isJsonArray,
  });

  check(notices, {
    'Steady admin notices status is 200': response =>
      response.status === 200,

    'Steady admin notices returned an array':
      isJsonArray,
  });

  check(membershipOwners, {
    'Steady admin membership owners status is 200': response =>
      response.status === 200,

    'Steady admin membership owners returned an array':
      isJsonArray,
  });

  check(membershipRequests, {
    'Steady admin membership requests status is 200': response =>
      response.status === 200,

    'Steady admin membership requests returned an array':
      isJsonArray,
  });

  check(notifications, {
    'Steady admin notifications status is 200': response =>
      response.status === 200,

    'Steady admin notifications returned an array':
      isJsonArray,
  });

  journeyDuration.add(
    Date.now() - journeyStartedAt,
  );
}

export function teardown(data) {
  if (!data?.accessToken) {
    return;
  }

  http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: supabaseHeaders(data.accessToken),
      timeout: '15s',
      tags: {
        endpoint: 'admin_steady_teardown_logout',
      },
    },
  );
}