import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const TENANT_EMAIL = __ENV.K6_TENANT_EMAIL || '';
const TENANT_PASSWORD = __ENV.K6_TENANT_PASSWORD || '';

const steadyPageDuration = new Trend('tenant_steady_page_duration', true);
const steadyResourcesDuration = new Trend('tenant_steady_resources_duration', true);

export const options = {
  scenarios: {
    tenant_dashboard_steady_rate: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    'http_req_failed{test_scope:tenant_steady_workload}': ['rate<0.01'],
    tenant_steady_page_duration: ['p(95)<2000'],
    tenant_steady_resources_duration: ['p(95)<3000'],
    'http_req_duration{endpoint:tenant_steady_page}': ['p(95)<2000'],
    'http_req_duration{endpoint:tenant_steady_payments}': ['p(95)<1000'],
    'http_req_duration{endpoint:tenant_steady_notices}': ['p(95)<1000'],
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

function buildCookieHeader(response) {
  const cookieParts = [];

  for (const cookieName in response.cookies) {
    const cookieValues = response.cookies[cookieName];

    if (Array.isArray(cookieValues) && cookieValues[0]?.value) {
      cookieParts.push(`${cookieName}=${cookieValues[0].value}`);
    }
  }

  return cookieParts.join('; ');
}

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  if (!TENANT_EMAIL || !TENANT_PASSWORD) {
    fail('Missing K6_TENANT_EMAIL or K6_TENANT_PASSWORD.');
  }

  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TENANT_EMAIL,
      password: TENANT_PASSWORD,
    }),
    {
      headers: supabaseHeaders(),
      timeout: '15s',
      tags: {
        endpoint: 'tenant_steady_setup_login',
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
    fail(`Tenant setup login failed with HTTP ${loginResponse.status}.`);
  }

  const headers = supabaseHeaders(accessToken);

  const userResponse = http.get(
    `${SUPABASE_URL}/rest/v1/users?select=id%2Crole%2Cis_active&id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers,
      timeout: '15s',
      tags: {
        endpoint: 'tenant_steady_setup_role',
      },
    },
  );

  const userRows = responseJson(userResponse, []);
  const user = Array.isArray(userRows) ? userRows[0] : null;

  if (
    userResponse.status !== 200 ||
    user?.role !== 'tenant' ||
    user?.is_active === false
  ) {
    fail('The supplied steady-state account is not an active tenant.');
  }

  const tenantSelect = encodeURIComponent(
    '*,rooms:room_id(*),property:property_id(*)',
  );

  const tenantResponse = http.get(
    `${SUPABASE_URL}/rest/v1/tenants?select=${tenantSelect}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers,
      timeout: '15s',
      tags: {
        endpoint: 'tenant_steady_setup_profile',
      },
    },
  );

  const tenantRows = responseJson(tenantResponse, []);
  const tenant = Array.isArray(tenantRows) ? tenantRows[0] : null;

  if (
    tenantResponse.status !== 200 ||
    !tenant?.id ||
    !tenant?.property_id ||
    !tenant?.room_id
  ) {
    fail(
      'No active tenant profile with a property and room was returned.',
    );
  }

  const sessionResponse = http.post(
    `${BASE_URL}/api/auth/session`,
    JSON.stringify({
      refreshToken,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      redirects: 0,
      tags: {
        endpoint: 'tenant_steady_setup_server_session',
      },
    },
  );

  if (sessionResponse.status !== 204) {
    fail(
      `Tenant setup server session failed with HTTP ${sessionResponse.status}.`,
    );
  }

  const sessionCookieHeader = buildCookieHeader(sessionResponse);

  if (!sessionCookieHeader) {
    fail(
      'Tenant setup server session did not return an authentication cookie.',
    );
  }

  return {
    accessToken,
    sessionCookieHeader,
    tenantId: tenant.id,
    propertyId: tenant.property_id,
    roomId: tenant.room_id,
    ownerId: tenant?.property?.owner_id || '',
  };
}

export default function (data) {
  const authHeaders = supabaseHeaders(data.accessToken);

  const dashboardResponse = http.get(
    `${BASE_URL}/tenant/dashboard`,
    {
      headers: {
        Cookie: data.sessionCookieHeader,
      },
      timeout: '15s',
      redirects: 0,
      tags: {
        endpoint: 'tenant_steady_page',
        test_scope: 'tenant_steady_workload',
      },
    },
  );

  steadyPageDuration.add(dashboardResponse.timings.duration);

  check(dashboardResponse, {
    'Steady tenant dashboard status is 200': response =>
      response.status === 200,
    'Steady tenant dashboard did not redirect': response =>
      ![301, 302, 303, 307, 308].includes(response.status),
    'Steady tenant dashboard body exists': response =>
      typeof response.body === 'string' &&
      response.body.length > 100,
  });

  const noticeFilter = encodeURIComponent(
    `property_id.eq.${data.propertyId},property_id.is.null`,
  );

  const resourcesStartedAt = Date.now();

  const responses = http.batch([
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/payment_history?select=*&tenant_id=eq.${encodeURIComponent(data.tenantId)}&order=payment_date.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_payments',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/owner_settings?select=upi_id%2Cupi_phone&property_id=eq.${encodeURIComponent(data.propertyId)}&limit=1`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_owner_settings',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/notices?select=*&or=(${noticeFilter})&order=created_at.desc&limit=10`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_notices',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/complaints?select=*&tenant_id=eq.${encodeURIComponent(data.tenantId)}&order=created_at.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_complaints',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/check_out_requests?select=*&tenant_id=eq.${encodeURIComponent(data.tenantId)}&order=created_at.desc&limit=10`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_vacates',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/room_change_requests?select=*&tenant_id=eq.${encodeURIComponent(data.tenantId)}&order=requested_at.desc`,
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_room_changes',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_my_roommate_contacts`,
      body: '{}',
      params: {
        headers: authHeaders,
        timeout: '15s',
        tags: {
          endpoint: 'tenant_steady_roommates',
          test_scope: 'tenant_steady_workload',
        },
      },
    },
    ...(data.ownerId
      ? [
          {
            method: 'GET',
            url: `${SUPABASE_URL}/rest/v1/users?select=full_name%2Cphone%2Cemail&id=eq.${encodeURIComponent(data.ownerId)}&limit=1`,
            params: {
              headers: authHeaders,
              timeout: '15s',
              tags: {
                endpoint: 'tenant_steady_owner_contact',
                test_scope: 'tenant_steady_workload',
              },
            },
          },
        ]
      : []),
  ]);

  steadyResourcesDuration.add(
    Date.now() - resourcesStartedAt,
  );

  const [
    payments,
    settings,
    notices,
    complaints,
    vacates,
    roomChanges,
    roommates,
    ownerContact,
  ] = responses;

  check(payments, {
    'Steady tenant payments status is 200': response =>
      response.status === 200,
    'Steady tenant payments returned an array': isJsonArray,
  });

  check(settings, {
    'Steady tenant owner settings status is 200': response =>
      response.status === 200,
    'Steady tenant owner settings returned an array': isJsonArray,
  });

  check(notices, {
    'Steady tenant notices status is 200': response =>
      response.status === 200,
    'Steady tenant notices returned an array': isJsonArray,
  });

  check(complaints, {
    'Steady tenant complaints status is 200': response =>
      response.status === 200,
    'Steady tenant complaints returned an array': isJsonArray,
  });

  check(vacates, {
    'Steady tenant vacates status is 200': response =>
      response.status === 200,
    'Steady tenant vacates returned an array': isJsonArray,
  });

  check(roomChanges, {
    'Steady tenant room changes status is 200': response =>
      response.status === 200,
    'Steady tenant room changes returned an array': isJsonArray,
  });

  check(roommates, {
    'Steady tenant roommates status is 200': response =>
      response.status === 200,
    'Steady tenant roommates returned an array': isJsonArray,
  });

  if (data.ownerId) {
    check(ownerContact, {
      'Steady tenant owner contact status is 200': response =>
        response.status === 200,
      'Steady tenant owner contact returned an array': isJsonArray,
    });
  }
}

export function teardown(data) {
  if (!data?.accessToken) {
    return;
  }

  if (data.sessionCookieHeader) {
    http.del(
      `${BASE_URL}/api/auth/session`,
      null,
      {
        headers: {
          Cookie: data.sessionCookieHeader,
        },
        timeout: '15s',
        redirects: 0,
        tags: {
          endpoint: 'tenant_steady_teardown_server_session',
        },
      },
    );
  }

  http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: supabaseHeaders(data.accessToken),
      timeout: '15s',
      tags: {
        endpoint: 'tenant_steady_teardown_logout',
      },
    },
  );
}