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

const tenantSupabaseDuration = new Trend(
  'tenant_supabase_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    tenant_supabase_isolation: {
      executor: 'constant-arrival-rate',
      rate: 150,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 250,
    },
  },

  thresholds: {
    checks: ['rate==1'],

    dropped_iterations: ['count==0'],

    'http_req_failed{test_scope:tenant_supabase_isolation}': [
      'rate<0.01',
    ],

    tenant_supabase_isolation_duration: [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:tenant_supabase_isolation}': [
      'p(95)<1000',
    ],
  },
};

function responseIsArray(response) {
  try {
    return Array.isArray(response.json());
  } catch (_) {
    return false;
  }
}

export function setup() {
  return tenantSetup();
}

export default function (data) {
  const response = http.get(
    `${SUPABASE_URL}/rest/v1/payment_history?select=*&tenant_id=eq.${encodeURIComponent(data.tenantId)}&order=payment_date.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${data.accessToken}`,
        Accept: 'application/json',
      },

      timeout: '15s',

      tags: {
        endpoint: 'tenant_supabase_isolation',
        test_scope: 'tenant_supabase_isolation',
      },
    },
  );

  tenantSupabaseDuration.add(
    response.timings.duration,
  );

  check(response, {
    'Isolated Supabase payment query status is 200':
      result => result.status === 200,

    'Isolated Supabase payment query returned an array':
      responseIsArray,
  });
}

export function teardown(data) {
  tenantTeardown(data);
}