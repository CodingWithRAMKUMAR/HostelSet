import loginWorkflow, {
  setup as validateLoginEnvironment,
} from './login.js';

export const options = {
  scenarios: {
    paced_owner_logins: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      gracefulStop: '30s',
    },
  },

  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    dropped_iterations: ['count==0'],
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