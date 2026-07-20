import tenantDashboardTest, {
  setup as tenantDashboardSetup,
} from './tenant-dashboard.js';

export const setup = tenantDashboardSetup;
export default tenantDashboardTest;

export const options = {
  scenarios: {
    concurrent_tenant_dashboards: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 5,
      maxDuration: '2m',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    tenant_login_duration: ['p(95)<2000'],
    tenant_server_session_duration: ['p(95)<2000'],
    tenant_dashboard_page_duration: ['p(95)<2000'],
    tenant_core_profile_duration: ['p(95)<2000'],
    tenant_dashboard_resources_duration: ['p(95)<3000'],
  },
};