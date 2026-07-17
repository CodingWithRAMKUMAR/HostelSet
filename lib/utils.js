import { useRef } from 'react';
import { calculateCanonicalRentDue, formatRentDueDetail, formatRentDueLabel, isPendingRentPayment } from './rentDue';
export { formatRentDueDetail, formatRentDueLabel };
export { isPendingRentPayment };
export { useRef };

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
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function calculateRentDueStatus(tenant, payments = [], now = new Date()) {
  return calculateCanonicalRentDue(tenant, payments, now)
}

export function calculateMembershipStatus(propertyData, now = new Date()) {
  if (!propertyData) return { active: false, status: 'none', expiryDate: null, daysLeft: null }
  if (!propertyData.membership_expiry) {
    return {
      active: false,
      status: propertyData.membership_active ? 'unknown' : 'none',
      expiryDate: null,
      daysLeft: null,
    }
  }
  const expiryDate = new Date(propertyData.membership_expiry)
  if (Number.isNaN(expiryDate.getTime())) {
    return { active: false, status: 'unknown', expiryDate: null, daysLeft: null }
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const expiryDay = new Date(expiryDate)
  expiryDay.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((expiryDay - today) / (1000 * 60 * 60 * 24))
  const active = Boolean(propertyData.membership_active) && daysLeft >= 0
  return {
    active,
    status: active ? 'active' : (propertyData.membership_active ? 'expired' : 'none'),
    expiryDate,
    daysLeft,
  }
}
