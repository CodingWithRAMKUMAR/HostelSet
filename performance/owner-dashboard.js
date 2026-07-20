import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = __ENV.K6_TEST_EMAIL;
const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD;

const dashboardPageDuration = new Trend(
  'owner_dashboard_page_duration',
  true
);

const coreDataDuration = new Trend(
  'owner_core_data_duration',
  true
);

export const options = {
  scenarios: {
    owner_dashboard_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    owner_dashboard_page_duration: ['p(95)<2000'],
    owner_core_data_duration: ['p(95)<2000'],
  },
};

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function restUrl(table, parameters) {
  const query = Object.keys(parameters)
    .map(function (key) {
      return (
        encodeURIComponent(key) +
        '=' +
        encodeURIComponent(parameters[key])
      );
    })
    .join('&');

  return `${SUPABASE_URL}/rest/v1/${table}?${query}`;
}

function parseArray(response) {
  try {
    return Array.isArray(response.json());
  } catch (error) {
    return false;
  }
}

export function setup() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !TEST_EMAIL ||
    !TEST_PASSWORD
  ) {
    fail('Missing Supabase configuration or owner test credentials.');
  }

  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      tags: {
        endpoint: 'owner_setup_login',
      },
    }
  );

  if (loginResponse.status !== 200) {
    fail(`Owner login failed with status ${loginResponse.status}.`);
  }

  let authData;

  try {
    authData = loginResponse.json();
  } catch (error) {
    fail('Owner login returned invalid JSON.');
  }

  const accessToken = authData.access_token;
  const refreshToken = authData.refresh_token;
  const userId = authData.user && authData.user.id;

  if (!accessToken || !refreshToken || !userId) {
    fail('Owner login did not return the required session values.');
  }

  const propertiesResponse = http.get(
    restUrl('properties', {
      select: 'id,name,owner_id',
      owner_id: `eq.${userId}`,
      order: 'created_at.asc',
      limit: '1',
    }),
    {
      headers: authHeaders(accessToken),
      timeout: '15s',
      tags: {
        endpoint: 'owner_setup_property',
      },
    }
  );

  if (propertiesResponse.status !== 200) {
    fail(
      `Owner property query failed with status ${propertiesResponse.status}.`
    );
  }

  let properties;

  try {
    properties = propertiesResponse.json();
  } catch (error) {
    fail('Owner property query returned invalid JSON.');
  }

  if (!Array.isArray(properties) || properties.length === 0) {
    fail('The test owner does not have a property.');
  }

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
    propertyId: properties[0].id,
  };
}

export default function (data) {
  const headers = authHeaders(data.accessToken);

  const sessionResponse = http.post(
    `${BASE_URL}/api/auth/session`,
    JSON.stringify({
      refreshToken: data.refreshToken,
    }),
    {
      headers: {
        Authorization: `Bearer ${data.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      tags: {
        endpoint: 'owner_server_session',
      },
    }
  );

  const sessionPassed = check(sessionResponse, {
    'Owner server session was created': function (response) {
      return response.status >= 200 && response.status < 300;
    },
  });

  if (!sessionPassed) {
    return;
  }

  const dashboardResponse = http.get(
    `${BASE_URL}/owner/dashboard`,
    {
      redirects: 0,
      timeout: '15s',
      tags: {
        endpoint: 'owner_dashboard_page',
      },
    }
  );

  dashboardPageDuration.add(
    dashboardResponse.timings.duration
  );

  check(dashboardResponse, {
    'Owner dashboard status is 200': function (response) {
      return response.status === 200;
    },
    'Owner dashboard was not redirected': function (response) {
      return !response.headers.Location;
    },
    'Owner dashboard body exists': function (response) {
      return (
        typeof response.body === 'string' &&
        response.body.length > 500
      );
    },
  });

  const requests = [
    {
      method: 'GET',
      url: restUrl('rooms', {
        select: '*',
        property_id: `eq.${data.propertyId}`,
        order: 'room_number.asc',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_rooms' },
      },
    },
    {
      method: 'GET',
      url: restUrl('tenants', {
        select: '*',
        property_id: `eq.${data.propertyId}`,
        status: 'in.(active,notice_period,payment_pending)',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_tenants' },
      },
    },
    {
      method: 'GET',
      url: restUrl('payment_history', {
        select: '*,tenants!inner(property_id)',
        'tenants.property_id': `eq.${data.propertyId}`,
        order: 'payment_date.desc',
        limit: '100',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_payments' },
      },
    },
    {
      method: 'GET',
      url: restUrl('applications', {
        select:
          '*,rooms(room_number,monthly_rent,deposit_amount,capacity)',
        property_id: `eq.${data.propertyId}`,
        status: 'eq.pending',
        deleted_at: 'is.null',
        order: 'created_at.desc',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_applications' },
      },
    },
    {
      method: 'GET',
      url: restUrl('pre_bookings', {
        select:
          '*,rooms(room_number,monthly_rent,capacity,current_occupants,has_approved_prebooking)',
        property_id: `eq.${data.propertyId}`,
        status: 'in.(pending,reserved,converted)',
        deleted_at: 'is.null',
        order: 'created_at.desc',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_prebookings' },
      },
    },
    {
      method: 'GET',
      url: restUrl('notices', {
        select: '*',
        or: `(property_id.eq.${data.propertyId},property_id.is.null)`,
        order: 'created_at.desc',
        limit: '10',
      }),
      params: {
        headers: headers,
        timeout: '15s',
        tags: { endpoint: 'owner_notices' },
      },
    },
  ];

  const dataStartedAt = Date.now();
  const responses = http.batch(requests);
  coreDataDuration.add(Date.now() - dataStartedAt);

  const names = [
    'rooms',
    'tenants',
    'payments',
    'applications',
    'pre-bookings',
    'notices',
  ];

  responses.forEach(function (response, index) {
    check(response, {
      [`Owner ${names[index]} status is 200`]: function (result) {
        return result.status === 200;
      },
      [`Owner ${names[index]} returned an array`]: function (result) {
        return parseArray(result);
      },
    });
  });

  const localLogoutResponse = http.del(
    `${BASE_URL}/api/auth/session`,
    null,
    {
      timeout: '15s',
      tags: {
        endpoint: 'owner_local_logout',
      },
    }
  );

  check(localLogoutResponse, {
    'Owner local session was cleared': function (response) {
      return response.status >= 200 && response.status < 300;
    },
  });

  const supabaseLogoutResponse = http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: headers,
      timeout: '15s',
      tags: {
        endpoint: 'owner_supabase_logout',
      },
    }
  );

  check(supabaseLogoutResponse, {
    'Owner Supabase session was cleared': function (response) {
      return response.status === 200 ||
        response.status === 204;
    },
  });
}