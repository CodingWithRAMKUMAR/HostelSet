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

const resourcesDuration = new Trend(
  'admin_resources_isolation_duration',
  true,
);

export const options = {
  scenarios: {
    admin_resources_isolation: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 200,
      maxVUs: 200,
    },
  },

  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],

    'http_req_failed{test_scope:admin_resources_isolation}': [
      {
        threshold: 'rate<0.01',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],

    admin_resources_isolation_duration: [
      'p(95)<3000',
    ],

    'http_req_duration{endpoint:admin_resource_stats}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_payments}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_prebookings}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_applications}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_complaints}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_vacates}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_room_changes}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_notices}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_membership_owners}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_membership_requests}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_resource_notifications}': [
      'p(95)<1000',
    ],
  },
};

function headers(accessToken) {
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

function isJsonArray(response) {
  return Array.isArray(
    responseJson(response, null),
  );
}

function encoded(value) {
  return encodeURIComponent(value);
}

function resourceGet(
  path,
  accessToken,
  endpoint,
) {
  return {
    method: 'GET',
    url: `${SUPABASE_URL}/rest/v1/${path}`,

    params: {
      headers: headers(accessToken),
      timeout: '15s',

      tags: {
        endpoint,
        test_scope: 'admin_resources_isolation',
      },
    },
  };
}

export const setup = verifiedAdminSetup;
export const teardown = verifiedAdminTeardown;

export default function (data) {
  const accessToken = data.accessToken;
  const authHeaders = headers(accessToken);

  const paymentSelect = encoded(
    '*,tenants(name,phone,room_id,rooms(room_number))',
  );

  const preBookingSelect = encoded(
    '*,rooms(room_number,monthly_rent,capacity,current_occupants,has_approved_prebooking,property_id,properties(name))',
  );

  const applicationSelect = encoded(
    '*,rooms(room_number,monthly_rent,property_id)',
  );

  const complaintSelect = encoded(
    '*,tenants(name,phone)',
  );

  const vacateSelect = encoded(
    '*,tenants(name,phone,room_id,rooms(room_number))',
  );

  const roomChangeSelect = encoded(
    '*,tenants(name,phone),old_room:old_room_id(room_number),new_room:new_room_id(room_number)',
  );

  const membershipOwnerSelect = encoded(
    'id,full_name,email,phone,is_active,properties!properties_owner_id_fkey(id,name,membership_active,membership_expiry)',
  );

  const membershipRequestSelect = encoded(
    [
      'id',
      'owner_id',
      'property_id',
      'plan_id',
      'amount',
      'status',
      'requested_at',
      'reviewed_at',
      'reviewed_by',
      'admin_note',
      'owner:users!membership_requests_owner_id_fkey(id,full_name,email,phone,is_active)',
      'property:properties!membership_requests_property_id_fkey(id,name,address,city,lifecycle_status,archived_at)',
    ].join(','),
  );

  const requests = [
    {
      method: 'POST',

      url:
        `${SUPABASE_URL}/rest/v1/rpc/` +
        'get_admin_dashboard_stats',

      body: '{}',

      params: {
        headers: authHeaders,
        timeout: '15s',

        tags: {
          endpoint: 'admin_resource_stats',
          test_scope: 'admin_resources_isolation',
        },
      },
    },

    resourceGet(
      `payment_history?select=${paymentSelect}&order=payment_date.desc`,
      accessToken,
      'admin_resource_payments',
    ),

    resourceGet(
      `pre_bookings?select=${preBookingSelect}&status=in.(pending,reserved,converted)&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_resource_prebookings',
    ),

    resourceGet(
      `applications?select=${applicationSelect}&status=eq.pending&deleted_at=is.null&order=created_at.desc`,
      accessToken,
      'admin_resource_applications',
    ),

    resourceGet(
      `complaints?select=${complaintSelect}&order=created_at.desc`,
      accessToken,
      'admin_resource_complaints',
    ),

    resourceGet(
      `check_out_requests?select=${vacateSelect}&order=created_at.desc`,
      accessToken,
      'admin_resource_vacates',
    ),

    resourceGet(
      `room_change_requests?select=${roomChangeSelect}&order=requested_at.desc`,
      accessToken,
      'admin_resource_room_changes',
    ),

    resourceGet(
      'notices?select=*&order=created_at.desc',
      accessToken,
      'admin_resource_notices',
    ),

    resourceGet(
      `users?select=${membershipOwnerSelect}&role=eq.owner&order=created_at.desc`,
      accessToken,
      'admin_resource_membership_owners',
    ),

    resourceGet(
      `membership_requests?select=${membershipRequestSelect}&status=eq.pending&order=requested_at.asc`,
      accessToken,
      'admin_resource_membership_requests',
    ),

    resourceGet(
      `notifications?select=*&recipient_user_id=eq.${encoded(data.userId)}&order=created_at.desc&offset=0&limit=30`,
      accessToken,
      'admin_resource_notifications',
    ),
  ];

  const startedAt = Date.now();

  const responses = http.batch(requests);

  resourcesDuration.add(
    Date.now() - startedAt,
  );

  const statsBody = responseJson(
    responses[0],
    null,
  );

  check(responses[0], {
    'Resource stats status is 200': response =>
      response.status === 200,
  });

  check(statsBody, {
    'Resource stats returned an object': body =>
      Boolean(body) &&
      typeof body === 'object' &&
      !Array.isArray(body),

    'Resource stats include totals': body =>
      Number.isFinite(
        Number(body?.totalProperties),
      ) &&
      Number.isFinite(
        Number(body?.totalTenants),
      ),
  });

  const arrayResources = [
    ['payments', responses[1]],
    ['pre-bookings', responses[2]],
    ['applications', responses[3]],
    ['complaints', responses[4]],
    ['vacates', responses[5]],
    ['room changes', responses[6]],
    ['notices', responses[7]],
    ['membership owners', responses[8]],
    ['membership requests', responses[9]],
    ['notifications', responses[10]],
  ];

  for (
    const [label, response]
    of arrayResources
  ) {
    check(response, {
      [`Resource ${label} status is 200`]: result =>
        result.status === 200,

      [`Resource ${label} returned an array`]:
        isJsonArray,
    });
  }
}