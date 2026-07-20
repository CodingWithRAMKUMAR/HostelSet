import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TENANT_EMAIL = __ENV.K6_TENANT_EMAIL || '';
const TENANT_PASSWORD = __ENV.K6_TENANT_PASSWORD || '';

const loginDuration = new Trend('tenant_login_duration', true);
const serverSessionDuration = new Trend('tenant_server_session_duration', true);
const dashboardPageDuration = new Trend('tenant_dashboard_page_duration', true);
const coreProfileDuration = new Trend('tenant_core_profile_duration', true);
const dashboardResourcesDuration = new Trend('tenant_dashboard_resources_duration', true);

export const options = {
  scenarios: {
    tenant_dashboard_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    tenant_login_duration: ['p(95)<2000'],
    tenant_server_session_duration: ['p(95)<2000'],
    tenant_dashboard_page_duration: ['p(95)<2000'],
    tenant_core_profile_duration: ['p(95)<2000'],
    tenant_dashboard_resources_duration: ['p(95)<3000'],
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

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  if (!TENANT_EMAIL || !TENANT_PASSWORD) {
    fail('Missing K6_TENANT_EMAIL or K6_TENANT_PASSWORD.');
  }

  return { ready: true };
}

export default function () {
  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TENANT_EMAIL,
      password: TENANT_PASSWORD,
    }),
    {
      headers: supabaseHeaders(),
      timeout: '15s',
      tags: { endpoint: 'tenant_login' },
    },
  );

  loginDuration.add(loginResponse.timings.duration);

  const loginBody = responseJson(loginResponse, {});
  const accessToken = loginBody?.access_token || '';
  const refreshToken = loginBody?.refresh_token || '';
  const userId = loginBody?.user?.id || '';

  check(loginResponse, {
    'Tenant login connection succeeded': response => response.status !== 0,
    'Tenant login status is 200': response => response.status === 200,
  });

  check(loginBody, {
    'Tenant access token exists': body => Boolean(body?.access_token),
    'Tenant refresh token exists': body => Boolean(body?.refresh_token),
    'Tenant authenticated user ID exists': body => Boolean(body?.user?.id),
  });

  if (!accessToken || !refreshToken || !userId) {
    fail(`Tenant login failed with HTTP ${loginResponse.status}.`);
  }

  const authHeaders = supabaseHeaders(accessToken);

  const userResponse = http.get(
    `${SUPABASE_URL}/rest/v1/users?select=id%2Crole%2Cis_active&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: authHeaders,
      timeout: '15s',
      tags: { endpoint: 'tenant_user_role' },
    },
  );

  const userRows = responseJson(userResponse, []);
  const userProfile = Array.isArray(userRows) ? userRows[0] : null;

  check(userResponse, {
    'Tenant user query status is 200': response => response.status === 200,
  });

  check(userProfile, {
    'User is an active tenant': profile =>
      profile?.role === 'tenant' && profile?.is_active !== false,
  });

  if (
    !userProfile ||
    userProfile.role !== 'tenant' ||
    userProfile.is_active === false
  ) {
    fail('The supplied account is not an active tenant.');
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
      tags: { endpoint: 'tenant_server_session' },
    },
  );

  serverSessionDuration.add(sessionResponse.timings.duration);

  check(sessionResponse, {
    'Tenant server session connection succeeded': response =>
      response.status !== 0,
    'Tenant server session was created': response => response.status === 204,
  });

  if (sessionResponse.status !== 204) {
    fail(`Tenant server session failed with HTTP ${sessionResponse.status}.`);
  }

  const dashboardResponse = http.get(`${BASE_URL}/tenant/dashboard`, {
    timeout: '15s',
    redirects: 0,
    tags: { endpoint: 'tenant_dashboard_page' },
  });

  dashboardPageDuration.add(dashboardResponse.timings.duration);

  check(dashboardResponse, {
    'Tenant dashboard status is 200': response => response.status === 200,
    'Tenant dashboard did not redirect to login': response =>
      ![301, 302, 303, 307, 308].includes(response.status),
    'Tenant dashboard body exists': response =>
      typeof response.body === 'string' && response.body.length > 100,
  });

  const tenantSelect = encodeURIComponent(
    '*,rooms:room_id(*),property:property_id(*)',
  );

  const tenantResponse = http.get(
    `${SUPABASE_URL}/rest/v1/tenants?select=${tenantSelect}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: authHeaders,
      timeout: '15s',
      tags: { endpoint: 'tenant_core_profile' },
    },
  );

  coreProfileDuration.add(tenantResponse.timings.duration);

  const tenantRows = responseJson(tenantResponse, []);
  const tenant = Array.isArray(tenantRows) ? tenantRows[0] : null;

  check(tenantResponse, {
    'Tenant profile status is 200': response => response.status === 200,
  });

  check(tenant, {
    'Active tenant record exists': row =>
      Boolean(row?.id) &&
      ['active', 'notice_period', 'payment_pending'].includes(row?.status),
    'Tenant room data exists': row => Boolean(row?.rooms?.id),
    'Tenant property data exists': row => Boolean(row?.property?.id),
  });

  if (!tenant?.id || !tenant?.property_id || !tenant?.room_id) {
    fail('No active tenant profile with a property and room was returned.');
  }

  const ownerId = tenant?.property?.owner_id || '';

  const noticeFilter = encodeURIComponent(
    `property_id.eq.${tenant.property_id},property_id.is.null`,
  );

  const resourcesStartedAt = Date.now();

  const resourceResponses = http.batch([
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/payment_history?select=*&tenant_id=eq.${encodeURIComponent(tenant.id)}&order=payment_date.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_payments' },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/owner_settings?select=upi_id%2Cupi_phone&property_id=eq.${encodeURIComponent(tenant.property_id)}&limit=1`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_owner_settings' },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/notices?select=*&or=(${noticeFilter})&order=created_at.desc&limit=10`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_notices' },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/complaints?select=*&tenant_id=eq.${encodeURIComponent(tenant.id)}&order=created_at.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_complaints' },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/check_out_requests?select=*&tenant_id=eq.${encodeURIComponent(tenant.id)}&order=created_at.desc&limit=10`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_vacate_requests' },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/room_change_requests?select=*&tenant_id=eq.${encodeURIComponent(tenant.id)}&order=requested_at.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_room_changes' },
      },
    },
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_my_roommate_contacts`,
      body: '{}',
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: { endpoint: 'tenant_roommates' },
      },
    },
    ...(ownerId
      ? [
          {
            method: 'GET',
            url: `${SUPABASE_URL}/rest/v1/users?select=full_name%2Cphone%2Cemail&id=eq.${encodeURIComponent(ownerId)}&limit=1`,
            params: {
              headers: authHeaders,
              timeout: '15s',
              tags: { endpoint: 'tenant_owner_contact' },
            },
          },
        ]
      : []),
  ]);

  dashboardResourcesDuration.add(Date.now() - resourcesStartedAt);

  const [
    payments,
    settings,
    notices,
    complaints,
    vacates,
    roomChanges,
    roommates,
    ownerContact,
  ] = resourceResponses;

  check(payments, {
    'Tenant payments status is 200': response => response.status === 200,
    'Tenant payments returned an array': isJsonArray,
  });

  check(settings, {
    'Tenant owner settings status is 200': response => response.status === 200,
    'Tenant owner settings returned an array': isJsonArray,
  });

  check(notices, {
    'Tenant notices status is 200': response => response.status === 200,
    'Tenant notices returned an array': isJsonArray,
  });

  check(complaints, {
    'Tenant complaints status is 200': response => response.status === 200,
    'Tenant complaints returned an array': isJsonArray,
  });

  check(vacates, {
    'Tenant vacate requests status is 200': response => response.status === 200,
    'Tenant vacate requests returned an array': isJsonArray,
  });

  check(roomChanges, {
    'Tenant room changes status is 200': response => response.status === 200,
    'Tenant room changes returned an array': isJsonArray,
  });

  check(roommates, {
    'Tenant roommates RPC status is 200': response => response.status === 200,
    'Tenant roommates RPC returned an array': isJsonArray,
  });

  if (ownerId) {
    check(ownerContact, {
      'Tenant owner contact status is 200': response => response.status === 200,
      'Tenant owner contact returned an array': isJsonArray,
    });
  }

  const localLogoutResponse = http.del(
    `${BASE_URL}/api/auth/session`,
    null,
    {
      timeout: '15s',
      redirects: 0,
      tags: { endpoint: 'tenant_local_logout' },
    },
  );

  check(localLogoutResponse, {
    'Tenant local session was cleared': response => response.status === 204,
  });

  const supabaseLogoutResponse = http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: authHeaders,
      timeout: '15s',
      tags: { endpoint: 'tenant_supabase_local_logout' },
    },
  );

  check(supabaseLogoutResponse, {
    'Tenant Supabase local session was cleared': response =>
      [200, 204].includes(response.status),
  });
}