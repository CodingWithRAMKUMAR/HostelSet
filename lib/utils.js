export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export function formatDate(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getDaysOverdue(dueDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  if (today <= due) return 0
  return Math.ceil((today - due) / (1000 * 60 * 60 * 24))
}

export function getSharingDetails(type) {
  const details = {
    single: { label: 'Single Sharing', icon: '👤', capacity: 1, description: 'Private room for 1 person' },
    double: { label: 'Double Sharing', icon: '👥', capacity: 2, description: 'Shared room for 2 persons' },
    triple: { label: 'Triple Sharing', icon: '👥👤', capacity: 3, description: 'Shared room for 3 persons' },
    four: { label: 'Four Sharing', icon: '👥👥', capacity: 4, description: 'Shared room for 4 persons' },
    five: { label: 'Five Sharing', icon: '👥👥👤', capacity: 5, description: 'Shared room for 5 persons' },
    six: { label: 'Six Sharing', icon: '👥👥👥', capacity: 6, description: 'Shared room for 6 persons' },
    dormitory: { label: 'Dormitory', icon: '🏘️', capacity: 8, description: 'Large shared room' },
  }
  return details[type] || details.double
}

export function getPropertyTypeLabel(type) {
  const types = {
    boys: '👨 Boys PG',
    girls: '👩 Girls PG',
    'co-ed': '👥 Co-ed PG',
    professionals: '💼 Working Professionals'
  }
  return types[type] || type
}

export function cleanPhoneNumber(phone) {
  if (!phone) return ''
  return phone.toString().replace(/^\+91/, '').replace(/\s/g, '').trim()
}
