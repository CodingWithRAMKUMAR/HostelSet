import handler, { config } from './tenant-profile-photo'

export { config }

export default function tenantProfilePhotosHandler(req, res) {
  req.body = { ...(req.body || {}), action: 'batch-sign' }
  return handler(req, res)
}

