import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '2m';
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || 300);
const MAX_VUS = Number(__ENV.MAX_VUS || 800);

const rpcNetworkErrors = new Rate('rpc_network_errors');
const rpcHttpErrors = new Rate('rpc_http_errors');
const rpcDuration = new Trend('rpc_duration', true);

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const options = {
  scenarios: {
    public_properties_rpc: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: '30s',
    },
  },

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    rpc_network_errors: ['rate<0.001'],
    rpc_http_errors: ['rate<0.01'],
    rpc_duration: ['p(95)<1000'],
    dropped_iterations: ['count==0'],
  },
};

function callPropertiesRpc(testType) {
  return http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_public_properties_v2`,
    '{}',
    {
      headers,
      timeout: '15s',
      tags: {
        endpoint: 'supabase_properties_rpc',
        test_type: testType,
      },
    }
  );
}

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  const response = callPropertiesRpc('preflight');

  if (response.status !== 200) {
    fail(`Supabase preflight failed with status ${response.status}.`);
  }

  try {
    const properties = response.json();

    if (!Array.isArray(properties)) {
      fail('Supabase preflight did not return a JSON array.');
    }
  } catch {
    fail('Supabase preflight returned invalid JSON.');
  }

  return { rate: RATE };
}

export default function () {
  const response = callPropertiesRpc(`constant_${RATE}_rps`);

  const networkError = response.status === 0;
  const httpError = response.status !== 0 && response.status !== 200;

  rpcNetworkErrors.add(networkError);
  rpcHttpErrors.add(httpError);
  rpcDuration.add(response.timings.duration);

  check(response, {
    'RPC connection succeeded': (res) => res.status !== 0,
    'RPC status is 200': (res) => res.status === 200,
    'RPC returned a JSON array': (res) => {
      if (res.status !== 200) return false;

      try {
        return Array.isArray(res.json());
      } catch {
        return false;
      }
    },
  });
}
