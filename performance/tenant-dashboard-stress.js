import tenantDashboardJourney, {
  setup as tenantSetup,
  teardown as tenantTeardown,
} from './tenant-dashboard-rate.js';

export const options = {
  scenarios: {
    tenant_dashboard_stress: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 60,
      maxVUs: 150,
    },
  },
  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    'http_req_failed{test_scope:tenant_steady_workload}': [
      'rate<0.01',
    ],
    tenant_steady_page_duration: ['p(95)<2000'],
    tenant_steady_resources_duration: ['p(95)<3000'],
    'http_req_duration{endpoint:tenant_steady_page}': [
      'p(95)<2000',
    ],
    'http_req_duration{endpoint:tenant_steady_payments}': [
      'p(95)<1000',
    ],
    'http_req_duration{endpoint:tenant_steady_notices}': [
      'p(95)<1000',
    ],
  },
};

export function setup() {
  return tenantSetup();
}

export default function (data) {
  tenantDashboardJourney(data);
}

export function teardown(data) {
  tenantTeardown(data);
}