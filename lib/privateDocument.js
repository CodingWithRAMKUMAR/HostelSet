function normalizePrivateDocumentPath(path) {
  if (typeof path !== 'string') return null
  let objectPath = path.trim()
  if (!objectPath || /^(?:blob:|data:|https?:\/\/)/i.test(objectPath) || objectPath.includes('..') || /[?#]/.test(objectPath)) return null
  objectPath = objectPath.replace(/^\/+/, '').replace(/^tenant-documents\//i, '')
  if (!objectPath || objectPath.length > 1024 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(objectPath) || objectPath.includes('//')) return null
  return objectPath
}

function createExpiringRequestCache({ successTtlMs, missingTtlMs, now = () => Date.now() }) {
  const values = new Map()
  const requests = new Map()
  return {
    async getOrLoad(key, loader) {
      const cached = values.get(key)
      if (cached && cached.expiresAt > now()) return cached.value
      if (cached) values.delete(key)
      if (requests.has(key)) return requests.get(key)
      const request = Promise.resolve().then(loader).then(value => {
        values.set(key, { value: value || null, expiresAt: now() + (value ? successTtlMs : missingTtlMs) })
        return value || null
      }).finally(() => requests.delete(key))
      requests.set(key, request)
      return request
    },
    clear() { values.clear(); requests.clear() },
  }
}
module.exports = { normalizePrivateDocumentPath, createExpiringRequestCache }
