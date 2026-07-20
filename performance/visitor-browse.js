import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

export const options = {
  vus: 10,
  duration: '1m',

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{endpoint:supabase_properties_rpc}': ['p(95)<1000'],
    'http_req_duration{endpoint:property_details}': ['p(95)<2000'],
  },
};

function fetchProperties() {
  return http.post(
    `${SUPABASE_URL}/rest/v1/rpc/get_public_properties_v2`,
    '{}',
    {
      headers: supabaseHeaders,
      timeout: '15s',
      tags: {
        endpoint: 'supabase_properties_rpc',
        test_type: 'visitor_browse',
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
    fail(`HostelSet is unavailable. Homepage returned ${homepage.status}.`);
  }

  const propertiesResponse = fetchProperties();

  if (propertiesResponse.status !== 200) {
    fail(
      `Property RPC preflight failed with status ${propertiesResponse.status}.`
    );
  }

  let properties;

  try {
    properties = propertiesResponse.json();
  } catch {
    fail('Property RPC did not return valid JSON.');
  }

  if (!Array.isArray(properties) || properties.length === 0) {
    fail('Property RPC returned no public properties.');
  }

  const property = properties.find((item) => item.slug || item.id);

  if (!property) {
    fail('No property with a valid slug or ID was found.');
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
      test_type: 'visitor_browse',
    },
  });

  check(homepage, {
    'Homepage status is 200': (res) => res.status === 200,
    'Homepage body exists': (res) =>
      typeof res.body === 'string' && res.body.length > 100,
  });

  sleep(1);

  const browsePage = http.get(`${BASE_URL}/properties`, {
    timeout: '15s',
    tags: {
      endpoint: 'properties_page',
      test_type: 'visitor_browse',
    },
  });

  check(browsePage, {
    'Properties page status is 200': (res) => res.status === 200,
    'Properties page body exists': (res) =>
      typeof res.body === 'string' && res.body.length > 100,
  });

  sleep(1);

  const propertiesResponse = fetchProperties();

  const propertiesPassed = check(propertiesResponse, {
    'Property RPC status is 200': (res) => res.status === 200,
    'Property RPC returned JSON array': (res) => {
      try {
        return Array.isArray(res.json());
      } catch {
        return false;
      }
    },
  });

  if (!propertiesPassed) {
    sleep(2);
    return;
  }

  sleep(1);

  const propertyPage = http.get(`${BASE_URL}${data.propertyPath}`, {
    timeout: '15s',
    redirects: 5,
    tags: {
      endpoint: 'property_details',
      test_type: 'visitor_browse',
    },
  });

  check(propertyPage, {
    'Property details status is 200': (res) => res.status === 200,
    'Property details body exists': (res) =>
      typeof res.body === 'string' && res.body.length > 500,
    'Property details responded within 2 seconds': (res) =>
      res.timings.duration < 2000,
  });

  sleep(2);
}