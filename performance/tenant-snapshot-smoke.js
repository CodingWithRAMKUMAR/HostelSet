import http from 'k6/http';
import { check, fail } from 'k6';
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

const snapshotDuration = new Trend(
  'tenant_snapshot_duration',
  true,
);

const optimizedPageDuration = new Trend(
  'tenant_optimized_page_duration',
  true,
);

export const options = {
  scenarios: {
    tenant_snapshot_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
  },

  thresholds: {
    checks: ['rate==1'],

    'http_req_failed{test_scope:tenant_snapshot_smoke}': [
      'rate<0.01',
    ],

    tenant_snapshot_duration: ['p(95)<2000'],

    tenant_optimized_page_duration: ['p(95)<2000'],
  },
};

function responseJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

export function setup() {
  return tenantSetup();
}

export default function (data) {
  const snapshotResponse = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_my_tenant_dashboard_snapshot`,
    '{}',
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${data.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },

      timeout: '15s',

      tags: {
        endpoint: 'tenant_snapshot_rpc',
        test_scope: 'tenant_snapshot_smoke',
      },
    },
  );

  snapshotDuration.add(
    snapshotResponse.timings.duration,
  );

  const snapshot = responseJson(
    snapshotResponse,
    {},
  );

  check(snapshotResponse, {
    'Tenant snapshot RPC status is 200':
      response => response.status === 200,
  });

  check(snapshot, {
    'Tenant snapshot version is 1':
      body => body?.snapshot_version === 1,

    'Tenant snapshot role is tenant':
      body => body?.role === 'tenant',

    'Tenant snapshot contains tenant':
      body => Boolean(body?.tenant?.id),

    'Tenant snapshot contains room':
      body => Boolean(body?.tenant?.rooms?.id),

    'Tenant snapshot contains property':
      body => Boolean(body?.tenant?.property?.id),

    'Tenant snapshot contains payments array':
      body => Array.isArray(body?.payments),

    'Tenant snapshot contains notices array':
      body => Array.isArray(body?.notices),

    'Tenant snapshot contains complaints array':
      body => Array.isArray(body?.complaints),

    'Tenant snapshot contains vacate requests array':
      body => Array.isArray(body?.vacate_requests),
  });

  if (
    snapshotResponse.status !== 200 ||
    snapshot?.snapshot_version !== 1
  ) {
    fail(
      `Tenant snapshot validation failed with HTTP ${snapshotResponse.status}.`,
    );
  }

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
        test_scope: 'tenant_snapshot_smoke',
      },
    },
  );

  optimizedPageDuration.add(
    pageResponse.timings.duration,
  );

  check(pageResponse, {
    'Optimized tenant page status is 200':
      response => response.status === 200,

    'Optimized tenant page did not redirect':
      response =>
        ![301, 302, 303, 307, 308].includes(
          response.status,
        ),

    'Optimized tenant page body exists':
      response =>
        typeof response.body === 'string' &&
        response.body.length > 100,
  });
}

export function teardown(data) {
  tenantTeardown(data);
}