import loginWorkflow, {
  setup as validateLoginEnvironment,
} from './login.js';

export const options = {
  scenarios: {
    concurrent_owner_logins: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 20,
      maxDuration: '2m',
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
  return validateLoginEnvironment();
}

export default function (data) {
  loginWorkflow(data);
}