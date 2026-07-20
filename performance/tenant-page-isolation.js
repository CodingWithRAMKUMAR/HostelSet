import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import {
  setup as tenantSetup,
  teardown as tenantTeardown,
} from './tenant-dashboard-rate.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const tenantPageIsolationDuration = new Trend(
  'tenant_page_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    tenant_page_isolation: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 30,
      maxVUs: 100,
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    'http_req_failed{test_scope:tenant_page_isolation}': [
      'rate<0.01',
    ],
    tenant_page_isolation_duration: ['p(95)<2000'],
    'http_req_duration{endpoint:tenant_page_isolation}': [
      'p(95)<2000',
    ],
  },
};

export function setup() {
  return tenantSetup();
}

export default function (data) {
  const response = http.get(
    `${BASE_URL}/tenant/dashboard`,
    {
      headers: {
        Cookie: data.sessionCookieHeader,
      },
      timeout: '15s',
      redirects: 0,
      tags: {
        endpoint: 'tenant_page_isolation',
        test_scope: 'tenant_page_isolation',
      },
    },
  );

  tenantPageIsolationDuration.add(
    response.timings.duration,
  );

  check(response, {
    'Isolated tenant page status is 200': result =>
      result.status === 200,

    'Isolated tenant page did not redirect': result =>
      ![301, 302, 303, 307, 308].includes(
        result.status,
      ),

    'Isolated tenant page body exists': result =>
      typeof result.body === 'string' &&
      result.body.length > 100,
  });
}

export function teardown(data) {
  tenantTeardown(data);
}