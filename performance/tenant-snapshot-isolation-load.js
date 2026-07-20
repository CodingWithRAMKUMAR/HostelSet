import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import {
  setup as tenantSetup,
  teardown as tenantTeardown,
} from './tenant-dashboard-rate.js';

const SUPABASE_URL =
  __ENV.NEXT_PUBLIC_SUPABASE_URL || '';

const SUPABASE_ANON_KEY =
  __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const snapshotIsolationDuration = new Trend(
  'tenant_snapshot_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    tenant_snapshot_isolation: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
      maxVUs: 100,
    },
  },

  thresholds: {
    checks: ['rate==1'],

    dropped_iterations: ['count==0'],

    'http_req_failed{test_scope:tenant_snapshot_isolation}': [
      {
        threshold: 'rate<0.01',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],

    tenant_snapshot_isolation_duration: [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:tenant_snapshot_isolation}': [
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

export function setup() {
  return tenantSetup();
}

export default function (data) {
  const response = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_my_tenant_dashboard_snapshot`,
    '{}',
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${data.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },

      timeout: '10s',

      tags: {
        endpoint: 'tenant_snapshot_isolation',
        test_scope: 'tenant_snapshot_isolation',
      },
    },
  );

  snapshotIsolationDuration.add(
    response.timings.duration,
  );

  const snapshot = responseJson(response, {});

  check(response, {
    'Isolated snapshot status is 200':
      result => result.status === 200,
  });

  check(snapshot, {
    'Isolated snapshot version is 1':
      body => body?.snapshot_version === 1,

    'Isolated snapshot contains tenant':
      body => Boolean(body?.tenant?.id),

    'Isolated snapshot contains payments':
      body => Array.isArray(body?.payments),

    'Isolated snapshot contains notices':
      body => Array.isArray(body?.notices),

    'Isolated snapshot contains complaints':
      body => Array.isArray(body?.complaints),
  });
}

export function teardown(data) {
  tenantTeardown(data);
}