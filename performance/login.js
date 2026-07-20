import http from 'k6/http';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = __ENV.K6_TEST_EMAIL;
const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD;

const loginDuration = new Trend('login_duration', true);
const sessionDuration = new Trend('server_session_duration', true);
const dashboardDuration = new Trend('owner_dashboard_duration', true);

export const options = {
  scenarios: {
    owner_login_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    login_duration: ['p(95)<2000'],
    server_session_duration: ['p(95)<2000'],
    owner_dashboard_duration: ['p(95)<2000'],
  },
};

export function setup() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    fail('Missing K6_TEST_EMAIL or K6_TEST_PASSWORD.');
  }
}

export default function () {
  const loginResponse = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      tags: {
        endpoint: 'supabase_login',
        test_type: 'owner_login_smoke',
      },
    }
  );

  loginDuration.add(loginResponse.timings.duration);

  const loginPassed = check(loginResponse, {
    'Login connection succeeded': function (response) {
      return response.status !== 0;
    },
    'Login status is 200': function (response) {
      return response.status === 200;
    },
  });

  if (!loginPassed) {
    return;
  }

  let authData;

  try {
    authData = loginResponse.json();
  } catch (error) {
    check(null, {
      'Login returned valid JSON': function () {
        return false;
      },
    });

    return;
  }

  const accessToken = authData.access_token;
  const refreshToken = authData.refresh_token;
  const userId = authData.user && authData.user.id;

  const tokensPassed = check(authData, {
    'Access token exists': function () {
      return Boolean(accessToken);
    },
    'Refresh token exists': function () {
      return Boolean(refreshToken);
    },
    'Authenticated user ID exists': function () {
      return Boolean(userId);
    },
  });

  if (!tokensPassed) {
    return;
  }

  const userResponse = http.get(
    `${SUPABASE_URL}/rest/v1/users?select=id,role,is_active&id=eq.${encodeURIComponent(
      userId
    )}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: '15s',
      tags: {
        endpoint: 'authenticated_user',
        test_type: 'owner_login_smoke',
      },
    }
  );

  const userPassed = check(userResponse, {
    'User query status is 200': function (response) {
      return response.status === 200;
    },
    'User is an active owner': function (response) {
      try {
        const users = response.json();

        return (
          Array.isArray(users) &&
          users.length === 1 &&
          users[0].role === 'owner' &&
          users[0].is_active === true
        );
      } catch (error) {
        return false;
      }
    },
  });

  if (!userPassed) {
    return;
  }

  const sessionResponse = http.post(
    `${BASE_URL}/api/auth/session`,
    JSON.stringify({
      refreshToken: refreshToken,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '15s',
      tags: {
        endpoint: 'server_session',
        test_type: 'owner_login_smoke',
      },
    }
  );

  sessionDuration.add(sessionResponse.timings.duration);

  const sessionPassed = check(sessionResponse, {
    'Server session connection succeeded': function (response) {
      return response.status !== 0;
    },
    'Server session was created': function (response) {
      return response.status >= 200 && response.status < 300;
    },
  });

  if (!sessionPassed) {
    return;
  }

  const dashboardResponse = http.get(`${BASE_URL}/owner/dashboard`, {
    redirects: 0,
    timeout: '15s',
    tags: {
      endpoint: 'owner_dashboard',
      test_type: 'owner_login_smoke',
    },
  });

  dashboardDuration.add(dashboardResponse.timings.duration);

  check(dashboardResponse, {
    'Owner dashboard status is 200': function (response) {
      return response.status === 200;
    },
    'Owner dashboard did not redirect to login': function (response) {
      return !response.headers.Location;
    },
    'Owner dashboard body exists': function (response) {
      return (
        typeof response.body === 'string' &&
        response.body.length > 500
      );
    },
  });

  const localLogoutResponse = http.del(
    `${BASE_URL}/api/auth/session`,
    null,
    {
      timeout: '15s',
      tags: {
        endpoint: 'local_logout',
        test_type: 'owner_login_smoke',
      },
    }
  );

  check(localLogoutResponse, {
    'Local session was cleared': function (response) {
      return response.status >= 200 && response.status < 300;
    },
  });

  const supabaseLogoutResponse = http.post(
    `${SUPABASE_URL}/auth/v1/logout?scope=local`,
    null,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: '15s',
      tags: {
        endpoint: 'supabase_logout',
        test_type: 'owner_login_smoke',
      },
    }
  );

  check(supabaseLogoutResponse, {
    'Supabase local session was cleared': function (response) {
      return response.status === 200 ||
        response.status === 204;
    },
  });
}