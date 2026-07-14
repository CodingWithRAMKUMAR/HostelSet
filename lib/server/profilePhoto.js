const crypto = require('crypto')

const ALLOWED_PROFILE_PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024

function cleanBearerToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
}

function validateProfilePhotoUpload({ contentType, size }) {
  if (!ALLOWED_PROFILE_PHOTO_TYPES[contentType]) throw new Error('Profile photo must be a JPEG, PNG, or WEBP image')
  if (!Number.isSafeInteger(Number(size)) || Number(size) < 1 || Number(size) > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error('Profile photo must be under 5MB')
  }
}

function buildTenantProfilePhotoPath(propertyId, tenantId, contentType) {
  return `${propertyId}/profile-photos/${tenantId}/${crypto.randomUUID()}.${ALLOWED_PROFILE_PHOTO_TYPES[contentType]}`
}

function assertTenantProfilePhotoPath(path, propertyId, tenantId) {
  const value = String(path || '')
  const prefix = `${propertyId}/profile-photos/${tenantId}/`
  if (!value.startsWith(prefix) || value.includes('..') || value.includes('//')) {
    throw new Error('Profile photo upload is invalid')
  }
  return value
}

async function verifyProfilePhotoObject(supabaseAdmin, path) {
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const name = path.slice(slash + 1)
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').list(folder, { search: name, limit: 2 })
  const object = data?.find(item => item.name === name)
  const mime = object?.metadata?.mimetype || object?.metadata?.contentType
  const size = Number(object?.metadata?.size || 0)
  if (error || !object || !ALLOWED_PROFILE_PHOTO_TYPES[mime] || size < 1 || size > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error('Profile photo upload was not completed')
  }
}

function safeProfilePhotoPath(path, propertyId, tenantId = null) {
  const value = String(path || '')
  if (!value || value.startsWith('/') || value.includes('..') || value.includes('//')) return ''
  const profilePrefix = tenantId ? `${propertyId}/profile-photos/${tenantId}/` : `${propertyId}/profile-photos/`
  if (value.startsWith(profilePrefix)) return value
  if (!tenantId && value.startsWith(`${propertyId}/photos/`)) return value
  if (!tenantId && value.startsWith(`${propertyId}/imports/photos/`)) return value
  return ''
}

module.exports = {
  ALLOWED_PROFILE_PHOTO_TYPES,
  cleanBearerToken,
  validateProfilePhotoUpload,
  buildTenantProfilePhotoPath,
  assertTenantProfilePhotoPath,
  verifyProfilePhotoObject,
  safeProfilePhotoPath,
}

