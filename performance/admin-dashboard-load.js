import adminDashboardJourney, {
  setup as adminSetup,
} from './admin-dashboard.js';

export const options = {
  scenarios: {
    concurrent_admin_dashboards: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 5,
      maxDuration: '2m',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],

    admin_login_duration: ['p(95)<2000'],
    admin_server_session_duration: ['p(95)<2000'],
    admin_dashboard_page_duration: ['p(95)<2000'],
    admin_overview_resources_duration: ['p(95)<3000'],

    'http_req_duration{endpoint:admin_dashboard_stats}': [
      'p(95)<2000',
    ],
  },
};

export const setup = adminSetup;

export default function () {
  adminDashboardJourney();
}