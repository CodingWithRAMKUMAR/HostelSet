export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export function normalizeBloodGroup(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return BLOOD_GROUPS.includes(normalized) ? normalized : null
}

export function displayBloodGroup(value) {
  return normalizeBloodGroup(value) || 'Unknown / Prefer not to say'
}
