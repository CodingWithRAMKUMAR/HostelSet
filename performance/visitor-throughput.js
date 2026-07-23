import http from 'k6/http';
import { check, fail } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RATE = Number(__ENV.RATE || 200);
const DURATION = __ENV.DURATION || '2m';
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || 300);
const MAX_VUS = Number(__ENV.MAX_VUS || 500);

const rpcNetworkErrors = new Rate('visitor_rpc_network_errors');
const rpcHttpErrors = new Rate('visitor_rpc_http_errors');

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const options = {
  scenarios: {
    visitor_throughput: {
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
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{endpoint:homepage}': ['p(95)<1000'],
    'http_req_duration{endpoint:properties_page}': ['p(95)<1000'],
    'http_req_duration{endpoint:supabase_properties_rpc}': ['p(95)<1000'],
    'http_req_duration{endpoint:property_details}': ['p(95)<2000'],
    visitor_rpc_network_errors: ['rate<0.001'],
    visitor_rpc_http_errors: ['rate<0.01'],
    dropped_iterations: ['count==0'],
  },
};

function fetchProperties(testType, endpoint) {
  const metricEndpoint = endpoint || 'supabase_properties_rpc';

  return http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_public_properties_v2`,
    '{}',
    {
      headers: supabaseHeaders,
      timeout: '15s',
      tags: {
        endpoint: metricEndpoint,
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

  const homepage = http.get(`${BASE_URL}/`, {
    timeout: '10s',
    tags: {
      endpoint: 'preflight_homepage',
      test_type: 'preflight',
    },
  });

  if (homepage.status !== 200) {
    fail(`HostelSet homepage returned status ${homepage.status}.`);
  }

  const propertiesResponse = fetchProperties(
    'preflight',
    'preflight_properties_rpc'
  );

  if (propertiesResponse.status !== 200) {
    fail(
      `Supabase property preflight returned status ${propertiesResponse.status}.`
    );
  }

  let properties;

  try {
    properties = propertiesResponse.json();
  } catch (error) {
    fail('Supabase property preflight returned invalid JSON.');
  }

  if (!Array.isArray(properties) || properties.length === 0) {
    fail('Supabase property preflight returned no properties.');
  }

  const property = properties.find(function (item) {
    return item.slug || item.id;
  });

  if (!property) {
    fail('No public property with a slug or ID was found.');
  }

  return {
    propertyPath: `/property/${property.slug || property.id}`,
  };
}

export default function (data) {
  const homepage = http.get(`${BASE_URL}/`, {
    timeout: '15s',
    tags: {
      endpoint: 'homepage',
      test_type: 'visitor_throughput',
    },
  });

  check(homepage, {
    'Homepage status is 200': function (response) {
      return response.status === 200;
    },
    'Homepage body exists': function (response) {
      return (
        typeof response.body === 'string' &&
        response.body.length > 100
      );
    },
  });

  const browsePage = http.get(`${BASE_URL}/properties`, {
    timeout: '15s',
    tags: {
      endpoint: 'properties_page',
      test_type: 'visitor_throughput',
    },
  });

  check(browsePage, {
    'Properties page status is 200': function (response) {
      return response.status === 200;
    },
    'Properties page body exists': function (response) {
      return (
        typeof response.body === 'string' &&
        response.body.length > 100
      );
    },
  });

  const propertiesResponse = fetchProperties('visitor_throughput');

  const networkError = propertiesResponse.status === 0;
  const httpError =
    propertiesResponse.status !== 0 &&
    propertiesResponse.status !== 200;

  rpcNetworkErrors.add(networkError);
  rpcHttpErrors.add(httpError);

  const rpcPassed = check(propertiesResponse, {
    'Property RPC connection succeeded': function (response) {
      return response.status !== 0;
    },
    'Property RPC status is 200': function (response) {
      return response.status === 200;
    },
    'Property RPC returned JSON array': function (response) {
      if (response.status !== 200) {
        return false;
      }

      try {
        return Array.isArray(response.json());
      } catch (error) {
        return false;
      }
    },
  });

  if (!rpcPassed) {
    return;
  }

  const propertyPage = http.get(`${BASE_URL}${data.propertyPath}`, {
    timeout: '15s',
    redirects: 5,
    tags: {
      endpoint: 'property_details',
      test_type: 'visitor_throughput',
    },
  });

  check(propertyPage, {
    'Property details status is 200': function (response) {
      return response.status === 200;
    },
    'Property details body exists': function (response) {
      return (
        typeof response.body === 'string' &&
        response.body.length > 500
      );
    },
    'Property details responded within 2 seconds': function (response) {
      return response.timings.duration < 2000;
    },
  });
}

