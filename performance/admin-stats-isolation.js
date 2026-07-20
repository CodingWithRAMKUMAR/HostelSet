import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

import {
  setup as verifiedAdminSetup,
  teardown as verifiedAdminTeardown,
} from './admin-dashboard-rate.js';

const SUPABASE_URL = (
  __ENV.NEXT_PUBLIC_SUPABASE_URL || ''
).replace(/\/+$/, '');

const SUPABASE_ANON_KEY =
  __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const statsDuration = new Trend(
  'admin_stats_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    admin_stats_isolation: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
      maxVUs: 100,
    },
  },

  thresholds: {
    checks: [
      'rate==1',
    ],

    dropped_iterations: [
      'count==0',
    ],

    'http_req_failed{test_scope:admin_stats_isolation}': [
      'rate<0.01',
    ],

    'http_req_duration{endpoint:admin_stats_isolation}': [
      'p(95)<1000',
    ],

    admin_stats_isolation_duration: [
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

export const setup = verifiedAdminSetup;
export const teardown = verifiedAdminTeardown;

export default function (data) {
  const response = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_stats`,
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
        endpoint: 'admin_stats_isolation',
        test_scope: 'admin_stats_isolation',
      },
    },
  );

  statsDuration.add(
    response.timings.duration,
  );

  const body = responseJson(
    response,
    null,
  );

  check(response, {
    'Isolated admin stats status is 200': result =>
      result.status === 200,
  });

  check(body, {
    'Isolated admin stats returned an object': result =>
      Boolean(result) &&
      typeof result === 'object' &&
      !Array.isArray(result),

    'Isolated admin stats include total properties': result =>
      Number.isFinite(
        Number(result?.totalProperties),
      ),

    'Isolated admin stats include total tenants': result =>
      Number.isFinite(
        Number(result?.totalTenants),
      ),
  });
}