import adminDashboardJourney, {
  setup as adminSetup,
  teardown as adminTeardown,
} from './admin-dashboard-rate.js';

export const options = {
  scenarios: {
    admin_10_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'adminCapacityJourney',
      rate: 10,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 30,
      maxVUs: 50,
      gracefulStop: '5s',
      tags: {
        rate_level: '10',
      },
    },

    admin_20_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'adminCapacityJourney',
      startTime: '25s',
      rate: 20,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 50,
      maxVUs: 90,
      gracefulStop: '5s',
      tags: {
        rate_level: '20',
      },
    },

    admin_30_per_second: {
      executor: 'constant-arrival-rate',
      exec: 'adminCapacityJourney',
      startTime: '50s',
      rate: 30,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 70,
      maxVUs: 130,
      gracefulStop: '5s',
      tags: {
        rate_level: '30',
      },
    },
  },

  thresholds: {
    checks: [
      'rate==1',
    ],

    dropped_iterations: [
      'count==0',
    ],

    'http_req_failed{test_scope:admin_steady_workload}': [
      {
        threshold: 'rate<0.01',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],

    'http_req_duration{endpoint:admin_steady_page,rate_level:10}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:admin_steady_page,rate_level:20}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:admin_steady_page,rate_level:30}': [
      'p(95)<2000',
    ],

    'http_req_duration{endpoint:admin_steady_stats,rate_level:10}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_steady_stats,rate_level:20}': [
      'p(95)<1000',
    ],

    'http_req_duration{endpoint:admin_steady_stats,rate_level:30}': [
      'p(95)<1000',
    ],

    'admin_steady_journey_duration{rate_level:10}': [
      'p(95)<4000',
    ],

    'admin_steady_journey_duration{rate_level:20}': [
      {
        threshold: 'p(95)<4000',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],

    'admin_steady_journey_duration{rate_level:30}': [
      {
        threshold: 'p(95)<4000',
        abortOnFail: true,
        delayAbortEval: '10s',
      },
    ],
  },

  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
  ],
};

export const setup = adminSetup;
export const teardown = adminTeardown;

export function adminCapacityJourney(data) {
  adminDashboardJourney(data);
}