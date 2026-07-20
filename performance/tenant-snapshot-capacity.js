import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import {
  setup as tenantSetup,
  teardown as tenantTeardown,
} from './tenant-dashboard-rate.js';

const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const snapshotCapacityDuration = new Trend(
  'tenant_snapshot_capacity_duration',
  true,
);

export const options = {
  scenarios: {
    snapshot_5_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'snapshotRequest',
      rate: 5,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 10,
      maxVUs: 20,
      gracefulStop: '5s',
      tags: { rate_level: '5' },
    },
    snapshot_10_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'snapshotRequest',
      startTime: '25s',
      rate: 10,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 20,
      maxVUs: 40,
      gracefulStop: '5s',
      tags: { rate_level: '10' },
    },
    snapshot_20_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'snapshotRequest',
      startTime: '50s',
      rate: 20,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 40,
      maxVUs: 80,
      gracefulStop: '5s',
      tags: { rate_level: '20' },
    },
    snapshot_30_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'snapshotRequest',
      startTime: '1m15s',
      rate: 30,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 60,
      maxVUs: 100,
      gracefulStop: '5s',
      tags: { rate_level: '30' },
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    'http_req_failed{test_scope:tenant_snapshot_capacity}': ['rate<0.01'],
    'http_req_duration{test_scope:tenant_snapshot_capacity,rate_level:5}': [
      'p(95)<1000',
    ],
    'http_req_duration{test_scope:tenant_snapshot_capacity,rate_level:10}': [
      'p(95)<1000',
    ],
    'http_req_duration{test_scope:tenant_snapshot_capacity,rate_level:20}': [
      'p(95)<1000',
    ],
    'http_req_duration{test_scope:tenant_snapshot_capacity,rate_level:30}': [
      {
        threshold: 'p(95)<1000',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],
    tenant_snapshot_capacity_duration: ['p(95)<1000'],
  },
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
  ],
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

export function snapshotRequest(data) {
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
      timeout: '5s',
      tags: {
        endpoint: 'tenant_snapshot_capacity',
        test_scope: 'tenant_snapshot_capacity',
      },
    },
  );

  snapshotCapacityDuration.add(response.timings.duration);
  const snapshot = responseJson(response, {});

  check(response, {
    'Capacity snapshot status is 200': result => result.status === 200,
  });

  check(snapshot, {
    'Capacity snapshot version is 1': body =>
      body?.snapshot_version === 1,
    'Capacity snapshot role is tenant': body =>
      body?.role === 'tenant',
    'Capacity snapshot contains tenant': body =>
      Boolean(body?.tenant?.id),
    'Capacity snapshot contains payments': body =>
      Array.isArray(body?.payments),
    'Capacity snapshot contains notices': body =>
      Array.isArray(body?.notices),
    'Capacity snapshot contains complaints': body =>
      Array.isArray(body?.complaints),
  });
}

export function teardown(data) {
  tenantTeardown(data);
}