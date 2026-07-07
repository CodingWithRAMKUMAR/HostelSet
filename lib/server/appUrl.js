const DEFAULT_APP_URL = 'https://www.hostelset.com'

export function getAppUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '')
  return configured === 'https://hostelset.com' ? DEFAULT_APP_URL : configured
}

export function getResetPasswordUrl() {
  return `${getAppUrl()}/reset-password`
}

export function getLoginUrl() {
  return `${getAppUrl()}/login`
}
