import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 250 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 1250 },
    { duration: '30s', target: 1500 },
    { duration: '1m30s', target: 1500 },
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  const response = http.get(`${BASE_URL}/`, {
    timeout: '10s',
    tags: {
      endpoint: 'homepage_preflight',
      test_type: 'preflight',
    },
  });

  if (response.status !== 200) {
    fail(
      `HostelSet is not ready. Expected status 200 but received ${response.status}.`
    );
  }

  return {
    serverReady: true,
  };
}

export default function (data) {
  if (!data.serverReady) {
    fail('The server readiness check did not succeed.');
  }

  const response = http.get(`${BASE_URL}/`, {
    timeout: '15s',
    redirects: 5,
    tags: {
      endpoint: 'homepage',
      test_type: 'local_homepage_breakpoint_1500_users',
    },
  });

  check(response, {
    'Status is 200': (res) => res.status === 200,
    'Response time < 2s': (res) => res.timings.duration < 2000,
    'Response body exists': (res) =>
      typeof res.body === 'string' && res.body.length > 100,
  });

  sleep(1);
}