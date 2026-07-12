function isDashboardPath(pathname = '') {
  return ['/owner', '/tenant', '/admin'].some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
module.exports = { isDashboardPath }
