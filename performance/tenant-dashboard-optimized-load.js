import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import {
  setup as tenantSetup,
  teardown as tenantTeardown,
} from './tenant-dashboard-rate.js';

const BASE_URL =
  __ENV.BASE_URL || 'http://localhost:3000';

const SUPABASE_URL =
  __ENV.NEXT_PUBLIC_SUPABASE_URL || '';

const SUPABASE_ANON_KEY =
  __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const optimizedJourneyDuration = new Trend(
  'tenant_optimized_journey_duration',
  true,
);

export const options = {
  scenarios: {
    tenant_dashboard_optimized_load: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },

  thresholds: {
    checks: ['rate==1'],

    dropped_iterations: ['count==0'],

    'http_req_failed{test_scope:tenant_optimized_workload}': [
      'rate<0.01',
    ],

    tenant_optimized_journey_duration: [
      'p(95)<3000',
    ],

    'http_req_duration{endpoint:tenant_optimized_page}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:tenant_optimized_snapshot}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:tenant_optimized_roommates}': [
      'p(95)<1000',
    ],
  },
};

function responseJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function authenticatedHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function setup() {
  return tenantSetup();
}

export default function (data) {
  const journeyStartedAt = Date.now();

  const pageResponse = http.get(
    `${BASE_URL}/tenant/dashboard`,
    {
      headers: {
        Cookie: data.sessionCookieHeader,
      },

      timeout: '15s',
      redirects: 0,

      tags: {
        endpoint: 'tenant_optimized_page',
        test_scope: 'tenant_optimized_workload',
      },
    },
  );

  check(pageResponse, {
    'Optimized load page status is 200':
      response => response.status === 200,

    'Optimized load page did not redirect':
      response =>
        ![301, 302, 303, 307, 308].includes(
          response.status,
        ),

    'Optimized load page body exists':
      response =>
        typeof response.body === 'string' &&
        response.body.length > 100,
  });

  const snapshotResponse = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_my_tenant_dashboard_snapshot`,
    '{}',
    {
      headers: authenticatedHeaders(
        data.accessToken,
      ),

      timeout: '15s',

      tags: {
        endpoint: 'tenant_optimized_snapshot',
        test_scope: 'tenant_optimized_workload',
      },
    },
  );

  const snapshot = responseJson(
    snapshotResponse,
    {},
  );

  check(snapshotResponse, {
    'Optimized load snapshot status is 200':
      response => response.status === 200,
  });

  check(snapshot, {
    'Optimized load snapshot version is 1':
      body => body?.snapshot_version === 1,

    'Optimized load snapshot has tenant':
      body => Boolean(body?.tenant?.id),

    'Optimized load snapshot has payments':
      body => Array.isArray(body?.payments),

    'Optimized load snapshot has notices':
      body => Array.isArray(body?.notices),

    'Optimized load snapshot has complaints':
      body => Array.isArray(body?.complaints),

    'Optimized load snapshot has vacate requests':
      body => Array.isArray(body?.vacate_requests),
  });

  const roommatesResponse = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_my_roommate_contacts`,
    '{}',
    {
      headers: authenticatedHeaders(
        data.accessToken,
      ),

      timeout: '15s',

      tags: {
        endpoint: 'tenant_optimized_roommates',
        test_scope: 'tenant_optimized_workload',
      },
    },
  );

  const roommates = responseJson(
    roommatesResponse,
    null,
  );

  check(roommatesResponse, {
    'Optimized load roommates status is 200':
      response => response.status === 200,
  });

  check(roommates, {
    'Optimized load roommates returned an array':
      body => Array.isArray(body),
  });

  optimizedJourneyDuration.add(
    Date.now() - journeyStartedAt,
  );
}

export function teardown(data) {
  tenantTeardown(data);
}