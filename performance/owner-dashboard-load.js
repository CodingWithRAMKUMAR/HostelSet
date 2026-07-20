import ownerDashboardWorkflow, {
  setup as prepareOwnerDashboard,
} from './owner-dashboard.js';

export const options = {
  scenarios: {
    concurrent_owner_dashboards: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 5,
      maxDuration: '2m',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    owner_dashboard_page_duration: ['p(95)<2000'],
    owner_core_data_duration: ['p(95)<2000'],
  },
};

export function setup() {
  return prepareOwnerDashboard();
}

export default function (data) {
  ownerDashboardWorkflow(data);
}