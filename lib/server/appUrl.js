const DEFAULT_APP_URL = 'https://www.hostelset.com'

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, '')
}

export function getResetPasswordUrl() {
  return `${getAppUrl()}/reset-password`
}

export function getLoginUrl() {
  return `${getAppUrl()}/login`
}
