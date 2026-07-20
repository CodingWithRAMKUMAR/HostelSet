import optimizedOverviewJourney, {
  setup as verifiedAdminSetup,
  teardown as verifiedAdminTeardown,
} from './admin-overview-optimized-smoke.js';

export const options = {
  scenarios: {
    admin_optimized_overview_load: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },

  thresholds: {
    checks: ['rate==1'],
    dropped_iterations: ['count==0'],
    http_req_failed: ['rate<0.01'],

    'http_req_duration{endpoint:admin_optimized_overview_page}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:admin_optimized_overview_stats}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_optimized_overview_snapshot}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_optimized_overview_notifications}': [
      'p(95)<1000',
    ],

    admin_optimized_overview_resources_duration: [
      'p(95)<2000',
    ],

    admin_optimized_overview_journey_duration: [
      'p(95)<3000',
    ],
  },
};

export const setup = verifiedAdminSetup;
export const teardown = verifiedAdminTeardown;

export default function (data) {
  optimizedOverviewJourney(data);
}