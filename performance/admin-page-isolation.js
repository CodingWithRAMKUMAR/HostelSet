import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

import {
  setup as verifiedAdminSetup,
  teardown as verifiedAdminTeardown,
} from './admin-dashboard-rate.js';

const BASE_URL = (
  __ENV.BASE_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

const pageDuration = new Trend(
  'admin_page_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    admin_page_isolation: {
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

    'http_req_failed{test_scope:admin_page_isolation}': [
      'rate<0.01',
    ],

    'http_req_duration{endpoint:admin_page_isolation}': [
      'p(95)<2000',
    ],

    admin_page_isolation_duration: [
      'p(95)<2000',
    ],
  },
};

export const setup = verifiedAdminSetup;
export const teardown = verifiedAdminTeardown;

export default function (data) {
  const cookieHeader = [
    `hostelset_access_token=${encodeURIComponent(
      data.accessToken,
    )}`,

    `hostelset_refresh_token=${encodeURIComponent(
      data.refreshToken,
    )}`,
  ].join('; ');

  const response = http.get(
    `${BASE_URL}/admin/dashboard`,
    {
      headers: {
        Cookie: cookieHeader,
      },

      timeout: '15s',
      redirects: 0,

      tags: {
        endpoint: 'admin_page_isolation',
        test_scope: 'admin_page_isolation',
      },
    },
  );

  pageDuration.add(
    response.timings.duration,
  );

  check(response, {
    'Isolated admin page status is 200': result =>
      result.status === 200,

    'Isolated admin page did not redirect': result =>
      ![301, 302, 303, 307, 308].includes(
        result.status,
      ),

    'Isolated admin page body exists': result =>
      typeof result.body === 'string' &&
      result.body.length > 100,
  });
}