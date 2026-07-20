import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import {
  setup as verifiedAdminSetup,
  teardown as verifiedAdminTeardown,
} from './admin-dashboard-rate.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SUPABASE_URL = (__ENV.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const pageDuration = new Trend('admin_optimized_overview_page_duration', true);
const statsDuration = new Trend('admin_optimized_overview_stats_duration', true);
const snapshotDuration = new Trend('admin_optimized_overview_snapshot_duration', true);
const resourcesDuration = new Trend('admin_optimized_overview_resources_duration', true);
const journeyDuration = new Trend('admin_optimized_overview_journey_duration', true);

export const options = {
  scenarios: {
    admin_optimized_overview_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '1m',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    'http_req_failed{test_scope:admin_optimized_overview_smoke}': ['rate<0.01'],
    admin_optimized_overview_page_duration: ['p(95)<2000'],
    admin_optimized_overview_stats_duration: ['p(95)<2000'],
    admin_optimized_overview_snapshot_duration: ['p(95)<2000'],
    admin_optimized_overview_resources_duration: ['p(95)<3000'],
    admin_optimized_overview_journey_duration: ['p(95)<5000'],
  },
};

function supabaseHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function responseJson(response, fallback = null) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const setup = verifiedAdminSetup;
export const teardown = verifiedAdminTeardown;

export default function (data) {
  const journeyStartedAt = Date.now();

  const cookieHeader = [
    `hostelset_access_token=${encodeURIComponent(data.accessToken)}`,
    `hostelset_refresh_token=${encodeURIComponent(data.refreshToken)}`,
  ].join('; ');

  const pageResponse = http.get(`${BASE_URL}/admin/dashboard`, {
    headers: { Cookie: cookieHeader },
    timeout: '15s',
    redirects: 0,
    tags: {
      endpoint: 'admin_optimized_overview_page',
      test_scope: 'admin_optimized_overview_smoke',
    },
  });

  pageDuration.add(pageResponse.timings.duration);

  check(pageResponse, {
    'Optimized admin page status is 200': response => response.status === 200,
    'Optimized admin page did not redirect': response =>
      ![301, 302, 303, 307, 308].includes(response.status),
    'Optimized admin page body exists': response =>
      typeof response.body === 'string' && response.body.length > 100,
  });

  const headers = supabaseHeaders(data.accessToken);
  const resourcesStartedAt = Date.now();

  const responses = http.batch([
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_stats`,
      body: '{}',
      params: {
        headers,
        timeout: '15s',
        tags: {
          endpoint: 'admin_optimized_overview_stats',
          test_scope: 'admin_optimized_overview_smoke',
        },
      },
    },
    {
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/rpc/get_admin_dashboard_overview_snapshot`,
      body: '{}',
      params: {
        headers,
        timeout: '15s',
        tags: {
          endpoint: 'admin_optimized_overview_snapshot',
          test_scope: 'admin_optimized_overview_smoke',
        },
      },
    },
    {
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/notifications?select=*&recipient_user_id=eq.${encodeURIComponent(data.userId)}&order=created_at.desc&offset=0&limit=30`,
      params: {
        headers,
        timeout: '15s',
        tags: {
          endpoint: 'admin_optimized_overview_notifications',
          test_scope: 'admin_optimized_overview_smoke',
        },
      },
    },
  ]);

  resourcesDuration.add(Date.now() - resourcesStartedAt);

  const [statsResponse, snapshotResponse, notificationsResponse] = responses;

  statsDuration.add(statsResponse.timings.duration);
  snapshotDuration.add(snapshotResponse.timings.duration);

  const stats = responseJson(statsResponse, null);
  const snapshot = responseJson(snapshotResponse, null);
  const notifications = responseJson(notificationsResponse, null);

  check(statsResponse, {
    'Optimized admin stats status is 200': response => response.status === 200,
  });

  check(stats, {
    'Optimized admin stats returned an object': isObject,
    'Optimized admin stats contain totals': value =>
      Number.isFinite(Number(value?.totalProperties)) &&
      Number.isFinite(Number(value?.totalTenants)),
  });

  check(snapshotResponse, {
    'Admin overview snapshot status is 200': response => response.status === 200,
  });

  check(snapshot, {
    'Admin overview snapshot version is 1': value =>
      Number(value?.snapshot_version) === 1,

    'Admin overview snapshot has counts': value =>
      isObject(value?.counts),

    'Admin overview snapshot membership requests is an array': value =>
      Array.isArray(value?.membership_requests),

    'Admin overview snapshot applications is an array': value =>
      Array.isArray(value?.applications),

    'Admin overview snapshot complaints is an array': value =>
      Array.isArray(value?.complaints),

    'Admin overview snapshot vacate requests is an array': value =>
      Array.isArray(value?.vacate_requests),

    'Admin overview snapshot room changes is an array': value =>
      Array.isArray(value?.room_changes),

    'Admin overview snapshot notices is an array': value =>
      Array.isArray(value?.notices),
  });

  check(notificationsResponse, {
    'Optimized admin notifications status is 200': response =>
      response.status === 200,
  });

  check(notifications, {
    'Optimized admin notifications returned an array': Array.isArray,
  });

  journeyDuration.add(Date.now() - journeyStartedAt);
}