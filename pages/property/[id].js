import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, getSharingDetails, getPropertyTypeLabel, cleanPhoneNumber, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import NearbyHostelMap from '../../components/maps/NearbyHostelMap'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import BrandLogo from '../../components/BrandLogo'
import ThemeToggle from '../../components/common/ThemeToggle'
import Head from 'next/head'
import Image from 'next/image'
import PublicFooter from '../../components/PublicFooter'
import { fetchWithTimeout } from '../../lib/fetchWithTimeout'
import { propertyPublicPath, UUID_PATTERN } from '../../lib/propertySlug'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')

const normalizeProperty = property => property ? {
  ...property,
  latitude: property.latitude != null ? Number(property.latitude) : null,
  longitude: property.longitude != null ? Number(property.longitude) : null,
} : null

const settingsFor = (property, settings) => ({
  upi_id: settings?.upi_id || property?.owner_upi_id || '',
  advance_months: settings?.advance_months || 1,
  joining_fee: settings?.joining_fee || 0,
  pre_booking_fee: settings?.pre_booking_fee ?? 999,
})

const buildVacateInfo = roomRows => {
  const info = {}
  const today = new Date()
  roomRows.forEach(room => {
    if (!room.next_vacate_date) return
    const vacateDate = new Date(`${room.next_vacate_date}T23:59:59`)
    if (Number.isNaN(vacateDate.getTime())) return
    info[room.id] = {
      daysLeft: Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24)),
      vacateDate: room.next_vacate_date,
    }
  })
  return info
}

const buildApprovedPrebookings = roomRows => Object.fromEntries(
  roomRows.filter(room => room.has_approved_prebooking).map(room => [room.id, true]),
)

const propertyImageLoader = ({ src }) => src

export default function PropertyDetail({ initialProperty = null, initialRooms = [], initialSettings = null, similarProperties = [] }) {
  const router = useRouter()
  const { id } = router.query
  const [property, setProperty] = useState(() => normalizeProperty(initialProperty))
  const [rooms, setRooms] = useState(initialRooms)
  const [loading, setLoading] = useState(!initialProperty)
  const [loadError, setLoadError] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [idProof, setIdProof] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('rooms')
  const [ownerSettings, setOwnerSettings] = useState(() => settingsFor(initialProperty, initialSettings))
  const [applySubmitting, setApplySubmitting] = useState(false)

  // Regular payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [transactionId, setTransactionId] = useState('')
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [paymentProgress, setPaymentProgress] = useState('')

  // Pre‑booking state
  const [vacateInfo, setVacateInfo] = useState(() => buildVacateInfo(initialRooms))
  const [showPrebookModal, setShowPrebookModal] = useState(false)
  const [prebookRoomId, setPrebookRoomId] = useState(null)
  const [prebookForm, setPrebookForm] = useState({ name: '', phone: '', email: '', move_in_date: '', message: '' })
  const [prebookIdProof, setPrebookIdProof] = useState(null)
  const [prebookPhoto, setPrebookPhoto] = useState(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [prebookSubmitting, setPrebookSubmitting] = useState(false)

  // Pre‑booking payment modal
  const [showPrebookPaymentModal, setShowPrebookPaymentModal] = useState(false)
  const [prebookPaymentScreenshot, setPrebookPaymentScreenshot] = useState(null)
  const [prebookTransactionId, setPrebookTransactionId] = useState('')
  const [prebookPaymentSubmitting, setPrebookPaymentSubmitting] = useState(false)
  const [prebookPaymentProgress, setPrebookPaymentProgress] = useState('')

  // Apply form validation
  const [phoneError, setPhoneError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneValid, setPhoneValid] = useState(false)
  const [emailValid, setEmailValid] = useState(false)
  const [checkingPhone, setCheckingPhone] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)

  // Pre‑booking form validation (same as apply)
  const [prebookPhoneError, setPrebookPhoneError] = useState('')
  const [prebookEmailError, setPrebookEmailError] = useState('')
  const [prebookPhoneValid, setPrebookPhoneValid] = useState(false)
  const [prebookEmailValid, setPrebookEmailValid] = useState(false)
  const [prebookCheckingPhone, setPrebookCheckingPhone] = useState(false)
  const [prebookCheckingEmail, setPrebookCheckingEmail] = useState(false)

  // To disable pre‑book button if room already has an approved pre‑booking
  const [approvedPrebookings, setApprovedPrebookings] = useState(() => buildApprovedPrebookings(initialRooms))
  const redirectTimerRef = useRef(null)
  const resolvedPropertyId = property?.id || (UUID_PATTERN.test(String(id || '')) ? id : null)

  useEffect(() => () => clearTimeout(redirectTimerRef.current), [])

  useEffect(() => {
    if (!id) return

    if (initialProperty && (initialProperty.id === id || initialProperty.slug === id)) {
      const normalizedProperty = normalizeProperty(initialProperty)
      setProperty(normalizedProperty)
      setRooms(initialRooms)
      setOwnerSettings(settingsFor(normalizedProperty, initialSettings))
      setVacateInfo(buildVacateInfo(initialRooms))
      setApprovedPrebookings(buildApprovedPrebookings(initialRooms))
      setLoadError('')
      setLoading(false)
      return
    }

    loadData()
  }, [id, initialProperty?.id])

  const loadData = async (background = false) => {
    if (!background) setLoading(true)
    if (!background) setLoadError('')
    try {
      let propertyQuery = supabase.from('properties').select('*').eq('is_active', true)
      propertyQuery = UUID_PATTERN.test(String(id || '')) ? propertyQuery.eq('id', id) : propertyQuery.eq('slug', id)
      const { data: propertyData, error: propertyError } = await propertyQuery.single()
      if (propertyError) throw propertyError
      const [{ data: roomsData, error: roomsError }, { data: settingsData }] = await Promise.all([
        supabase.from('rooms').select('*').eq('property_id', propertyData.id).order('room_number'),
        supabase.from('owner_settings').select('*').eq('property_id', propertyData.id).maybeSingle(),
      ])
      if (roomsError) throw roomsError
      const normalizedProperty = normalizeProperty(propertyData)
      setProperty(normalizedProperty)
      setRooms(roomsData || [])

      if (normalizedProperty) {
        setOwnerSettings(settingsFor(propertyData, settingsData))
      }

      loadVacateInfo(roomsData || [])
      loadApprovedPrebookings(roomsData || [])
    } catch (error) {
      console.error('Error:', error)
      if (!background) setLoadError('We could not load this property. Please check your connection and try again.')
    } finally {
      if (!background) setLoading(false)
    }
  }

  const loadVacateInfo = (roomRows) => {
    setVacateInfo(buildVacateInfo(roomRows))
  }

  const loadApprovedPrebookings = (roomRows) => {
    setApprovedPrebookings(buildApprovedPrebookings(roomRows))
  }

  const calculateTotalAmount = () => {
    return 3000
  }

  const handleFileChange = (e, setter) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be less than 5MB')
      return
    }
    setter(file)
  }

  const fileToPayload = file => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ data: reader.result, type: file.type, name: file.name })
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })

  const readApiResponse = async (response, fallbackMessage) => {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('application/json')) {
      await response.text().catch(() => '')
      throw new Error(response.ok ? fallbackMessage : `${fallbackMessage}. The server returned an invalid response; please retry.`)
    }
    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== 'object') throw new Error(fallbackMessage)
    return payload
  }

  const uploadPrivateFile = async (file, category) => {
    const response = await fetchWithTimeout('/api/visitor/upload-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: resolvedPropertyId, category, contentType: file.type, size: file.size }),
    }, 15000)
    const signed = await readApiResponse(response, 'Could not prepare upload')
    if (!response.ok) throw new Error(signed.error || 'Could not prepare upload')
    const { error } = await supabase.storage.from('tenant-documents').uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
    if (error) throw error
    return signed.path
  }

  useRealtimeRefresh(`public-property-live:${id || 'waiting'}`, ['properties', 'rooms', 'owner_settings'], loadData, Boolean(id), 120)

  // ========== Apply Form Validation (simplified) ==========
  const validatePhone = async (phone) => {
    const cleanPhone = cleanPhoneNumber(phone)
    if (!cleanPhone || cleanPhone.length !== 10) {
      setPhoneError('Enter a valid 10-digit phone number')
      setPhoneValid(false)
      return false
    }
    setCheckingPhone(true)
    try {
      setPhoneError('')
      setPhoneValid(true)
      return true
    } catch (error) {
      console.error('Phone validation error:', error)
      setPhoneError('Validation failed')
      setPhoneValid(false)
      return false
    } finally {
      setCheckingPhone(false)
    }
  }

  const validateEmail = async (email) => {
    if (!email || !email.includes('@')) {
      setEmailError('Enter a valid email address')
      setEmailValid(false)
      return false
    }
    setCheckingEmail(true)
    try {
      setEmailError('')
      setEmailValid(true)
      return true
    } catch (error) {
      console.error('Email validation error:', error)
      setEmailError('Validation failed')
      setEmailValid(false)
      return false
    } finally {
      setCheckingEmail(false)
    }
  }

  const handlePhoneBlur = async () => {
    if (applyForm.phone) await validatePhone(applyForm.phone)
    else {
      setPhoneError('Phone number is required')
      setPhoneValid(false)
    }
  }

  const handleEmailBlur = async () => {
    if (applyForm.email) await validateEmail(applyForm.email)
    else {
      setEmailError('Email is required')
      setEmailValid(false)
    }
  }

  // ========== Pre‑booking Form Validation (unchanged) ==========
  const validatePrebookPhone = async (phone) => {
    const cleanPhone = cleanPhoneNumber(phone)
    if (!cleanPhone || cleanPhone.length !== 10) {
      setPrebookPhoneError('Enter a valid 10-digit phone number')
      setPrebookPhoneValid(false)
      return false
    }
    setPrebookCheckingPhone(true)
    try {
      // Duplicate/account checks are enforced by the server without exposing PII.
      setPrebookPhoneError('')
      setPrebookPhoneValid(true)
      return true
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (existingUser) {
        setPrebookPhoneError('This phone number is already registered. Please login.')
        setPrebookPhoneValid(false)
        return false
      }
      const { data: existingPrebook } = await supabase
        .from('pre_bookings')
        .select('id')
        .eq('phone', cleanPhone)
        .eq('property_id', resolvedPropertyId)
        .in('status', ['pending', 'approved'])
        .is('deleted_at', null)
        .maybeSingle()
      if (existingPrebook) {
        if (existingPrebook.status === 'approved') {
          setPrebookPhoneError('You already have an approved pre‑booking for this property.')
          setPrebookPhoneValid(false)
          return false
        } else {
          setPrebookPhoneError('You already have a pending pre‑booking for this property.')
          setPrebookPhoneValid(false)
          return false
        }
      }
      setPrebookPhoneError('')
      setPrebookPhoneValid(true)
      return true
    } catch (error) {
      console.error('Prebook phone validation error:', error)
      setPrebookPhoneError('Validation failed')
      setPrebookPhoneValid(false)
      return false
    } finally {
      setPrebookCheckingPhone(false)
    }
  }

  const validatePrebookEmail = async (email) => {
    if (!email || !email.includes('@')) {
      setPrebookEmailError('Enter a valid email address')
      setPrebookEmailValid(false)
      return false
    }
    setPrebookCheckingEmail(true)
    try {
      // Duplicate/account checks are enforced by the server without exposing PII.
      setPrebookEmailError('')
      setPrebookEmailValid(true)
      return true
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (existingUser) {
        setPrebookEmailError('This email is already registered. Please login.')
        setPrebookEmailValid(false)
        return false
      }
      const { data: existingPrebook } = await supabase
        .from('pre_bookings')
        .select('id')
        .eq('email', email)
        .eq('property_id', resolvedPropertyId)
        .in('status', ['pending', 'approved'])
        .is('deleted_at', null)
        .maybeSingle()
      if (existingPrebook) {
        if (existingPrebook.status === 'approved') {
          setPrebookEmailError('You already have an approved pre‑booking for this property.')
          setPrebookEmailValid(false)
          return false
        } else {
          setPrebookEmailError('You already have a pending pre‑booking for this property.')
          setPrebookEmailValid(false)
          return false
        }
      }
      setPrebookEmailError('')
      setPrebookEmailValid(true)
      return true
    } catch (error) {
      console.error('Prebook email validation error:', error)
      setPrebookEmailError('Validation failed')
      setPrebookEmailValid(false)
      return false
    } finally {
      setPrebookCheckingEmail(false)
    }
  }

  const handlePrebookPhoneBlur = async () => {
    if (prebookForm.phone) await validatePrebookPhone(prebookForm.phone)
    else {
      setPrebookPhoneError('Phone number is required')
      setPrebookPhoneValid(false)
    }
  }

  const handlePrebookEmailBlur = async () => {
    if (prebookForm.email) await validatePrebookEmail(prebookForm.email)
    else {
      setPrebookEmailError('Email is required')
      setPrebookEmailValid(false)
    }
  }

  const findExistingUser = async (phone, email) => {
    if (phone) {
      const { data: userByPhone } = await supabase
        .from('users')
        .select('id, email')
        .eq('phone', phone)
        .limit(1)
      if (userByPhone && userByPhone.length > 0) return userByPhone[0]
    }
    if (email) {
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .limit(1)
      if (userByEmail && userByEmail.length > 0) return userByEmail[0]
    }
    return null
  }

  // ========== Regular Application Flow ==========
  // Step 1: Validate and open payment modal (no DB insert yet)
  const submitApplication = async () => {
    if (!applyForm.name || !applyForm.phone || !applyForm.email) {
      toast.error('Please fill all required fields (Name, Phone, Email)')
      return
    }
    const cleanPhone = cleanPhoneNumber(applyForm.phone)
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      return
    }
    if (!idProof || !photo) {
      toast.error('Please upload ID proof and photo')
      return
    }
    const phoneOk = await validatePhone(applyForm.phone)
    const emailOk = await validateEmail(applyForm.email)
    if (!phoneOk || !emailOk) {
      toast.error('Please correct the errors before submitting')
      return
    }

    // Close apply modal and open payment modal
    setShowApplyModal(false)
    setPaymentScreenshot(null)
    setTransactionId('')
    setShowPaymentModal(true)
  }

  // Step 2: After payment proof, insert application and tenant
  const submitPayment = async () => {
    if (paymentSubmitting) return
    setPaymentProgress('Validating payment details...')
    if (!paymentScreenshot) {
      toast.error('Please upload payment screenshot')
      return
    }
    if (!transactionId.trim()) {
      toast.error('Enter the UPI transaction/reference ID')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(paymentScreenshot.type)) {
      toast.error('Use a JPEG, PNG, WEBP, or PDF file')
      setPaymentScreenshot(null)
      return
    }
    if (!ownerSettings.upi_id) {
      toast.error('Owner payment details are not configured yet.')
      return
    }
    setPaymentSubmitting(true)
    try {
      setPaymentProgress('Uploading documents...')
      const [idPayload, photoPayload, paymentPayload] = await Promise.all([
        uploadPrivateFile(idProof, 'identity'), uploadPrivateFile(photo, 'photos'), uploadPrivateFile(paymentScreenshot, 'payments'),
      ])
      setPaymentProgress('Submitting application and sending invite...')
      const response = await fetchWithTimeout('/api/visitor/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'application', propertyId: resolvedPropertyId, roomId: selectedRoom, form: applyForm,
          files: { idProof: idPayload, photo: photoPayload, payment: paymentPayload }, transactionId,
        }),
      }, 30000)
      const result = await readApiResponse(response, 'Application submission failed')
      if (!response.ok) throw new Error(result.error || 'Submission failed')
      toast.success('Application submitted. You will receive a password setup email after approval.', { duration: 8000 })
      setShowPaymentModal(false)
      setApplyForm({ name: '', phone: '', email: '', message: '' })
      setIdProof(null); setPhoto(null); setPaymentScreenshot(null); setTransactionId('')
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => router.push('/login'), 8000)
    } catch (error) {
      toast.error(error.message || 'Application submission failed')
    } finally {
      setPaymentSubmitting(false)
      setPaymentProgress('')
    }
    return
    setPaymentSubmitting(true)
    try {
      const screenshotUrl = await uploadFile(paymentScreenshot, 'pay')
      const cleanPhone = cleanPhoneNumber(applyForm.phone)

      // 1. Create/update user
      let userId
      const existingUser = await findExistingUser(cleanPhone, applyForm.email)

      if (existingUser) {
        userId = existingUser.id
        await supabase.from('users').update({
          full_name: applyForm.name,
          email: applyForm.email,
        }).eq('id', userId)
      } else {
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).charAt(0).toUpperCase()
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: applyForm.email,
          password: tempPassword,
          options: { data: { full_name: applyForm.name, role: 'tenant', phone: cleanPhone } }
        })
        if (authError) throw authError

        // Check if user was already created by auth trigger (but we try to insert)
        const { data: newUserRows } = await supabase
          .from('users')
          .select('id')
          .eq('phone', cleanPhone)
          .limit(1)

        if (newUserRows && newUserRows.length > 0) {
          userId = newUserRows[0].id
          await supabase.from('users').update({
            full_name: applyForm.name,
            email: applyForm.email,
            role: 'tenant',
            is_active: true,
          }).eq('id', userId)
        } else {
          userId = authData.user.id
          const { error: insertError } = await supabase.from('users').insert({
            id: userId,
            email: applyForm.email,
            full_name: applyForm.name,
            phone: cleanPhone,
            role: 'tenant',
            is_active: true,
          })
          if (insertError) {
            if (insertError.message.includes('duplicate key value') || insertError.code === '23505') {
              // Fallback: fetch by phone again
              const { data: conflictingUser } = await supabase
                .from('users')
                .select('id')
                .eq('phone', cleanPhone)
                .limit(1)
              if (conflictingUser && conflictingUser.length > 0) {
                userId = conflictingUser[0].id
                await supabase.from('users').update({
                  full_name: applyForm.name,
                  email: applyForm.email,
                  role: 'tenant',
                  is_active: true,
                }).eq('id', userId)
              } else {
                throw insertError
              }
            } else {
              throw insertError
            }
          }
        }
      }

      // 2. Upload ID proof and photo (these were stored in state)
      const idUrl = await uploadFile(idProof, 'id')
      const photoUrl = await uploadFile(photo, 'photo')

      // 3. Insert application record (status = 'pending' initially)
      const { error: appError } = await supabase.from('applications').insert({
        user_id: userId,
        property_id: id,
        room_id: selectedRoom,
        name: applyForm.name,
        phone: cleanPhone,
        email: applyForm.email,
        message: applyForm.message,
        status: 'pending',
        id_proof: idUrl,
        photo: photoUrl,
        created_at: new Date(),
      })
      if (appError) {
        // If there's a duplicate, it might be from a previous attempt – we can ignore or cancel old one.
        // For safety, we'll just throw.
        throw new Error('Failed to create application: ' + appError.message)
      }

      // 4. Insert tenant record (status = 'payment_pending')
      const totalAmount = calculateTotalAmount() // now 3000
      const room = rooms.find(r => r.id === selectedRoom)

      const { error: tenantError } = await supabase.from('tenants').insert({
        user_id: userId,
        property_id: id,
        room_id: selectedRoom,
        name: applyForm.name,
        phone: cleanPhone,
        email: applyForm.email,
        rent_amount: room.monthly_rent,
        pending_amount: 0,
        total_paid: 0,
        rent_status: 'payment_pending',
        move_in_date: new Date().toISOString().split('T')[0],
        status: 'payment_pending',
        payment_screenshot: screenshotUrl,
        upi_transaction_id: transactionId,
      })
      if (tenantError) {
        throw new Error('Failed to create tenant: ' + tenantError.message)
      }

      // 5. Fetch the new tenant ID for payment history
      const { data: newTenant, error: fetchTenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .eq('property_id', id)
        .single()
      if (!fetchTenantError && newTenant && totalAmount > 0) {
        await supabase.from('payment_history').insert({
          tenant_id: newTenant.id,
          amount: totalAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'advance', // or 'security_deposit'
          status: 'payment_pending',
          upi_transaction_id: transactionId || null,
          payment_screenshot: screenshotUrl,
        })
      }

      toast.success(
        `🎉 Application submitted! Once the owner approves, you will receive an email to set your password.`,
        { duration: 8000 }
      )

      setShowPaymentModal(false)
      // Reset form state
      setApplyForm({ name: '', phone: '', email: '', message: '' })
      setIdProof(null)
      setPhoto(null)
      setPaymentScreenshot(null)
      setTransactionId('')
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => router.push('/login'), 8000)
    } catch (error) {
      console.error('Payment submission error:', error)
      toast.error('Something went wrong: ' + error.message)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // ========== PRE‑BOOKING FLOW (unchanged) ==========
  const openPrebookModal = (roomId, vacateDate) => {
    const today = new Date().toISOString().split('T')[0]
    setPrebookRoomId(roomId)
    setPrebookForm({
      name: '',
      phone: '',
      email: '',
      move_in_date: vacateDate && vacateDate > today ? vacateDate : today,
      message: ''
    })
    setPrebookIdProof(null)
    setPrebookPhoto(null)
    setAgreeTerms(false)
    setPrebookPhoneError('')
    setPrebookEmailError('')
    setPrebookPhoneValid(false)
    setPrebookEmailValid(false)
    setShowPrebookModal(true)
  }

  const submitPreBookingForm = async () => {
    if (!prebookForm.name || !prebookForm.phone || !prebookForm.email || !prebookForm.move_in_date) {
      toast.error('Please fill all required fields (Name, Phone, Email, Expected Move‑in Date)')
      return
    }
    const cleanPhone = cleanPhoneNumber(prebookForm.phone)
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      return
    }
    if (!prebookForm.email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    if (!prebookIdProof || !prebookPhoto) {
      toast.error('Please upload ID proof and passport photo')
      return
    }
    if (!agreeTerms) {
      toast.error('You must agree to the terms & conditions')
      return
    }
    if (!prebookRoomId) {
      toast.error('Room not selected')
      return
    }
    const phoneOk = await validatePrebookPhone(prebookForm.phone)
    const emailOk = await validatePrebookEmail(prebookForm.email)
    if (!phoneOk || !emailOk) {
      toast.error('Please correct the errors before proceeding')
      return
    }
    setShowPrebookModal(false)
    setShowPrebookPaymentModal(true)
  }

  const submitPreBookingPayment = async () => {
    if (prebookPaymentSubmitting) return
    setPrebookPaymentProgress('Validating payment details...')
    if (!prebookPaymentScreenshot) {
      toast.error('Please upload payment screenshot')
      return
    }
    const cleanPhone = cleanPhoneNumber(prebookForm.phone)
    if (!ownerSettings.upi_id) {
      toast.error('Owner payment details are not configured yet.')
      return
    }
    if (!prebookTransactionId.trim()) {
      toast.error('Enter the UPI transaction/reference ID')
      return
    }
    setPrebookPaymentSubmitting(true)
    try {
      setPrebookPaymentProgress('Uploading documents...')
      const [idPayload, photoPayload, paymentPayload] = await Promise.all([
        uploadPrivateFile(prebookIdProof, 'identity'), uploadPrivateFile(prebookPhoto, 'photos'), uploadPrivateFile(prebookPaymentScreenshot, 'payments'),
      ])
      setPrebookPaymentProgress('Submitting pre-booking...')
      const response = await fetchWithTimeout('/api/visitor/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'prebooking', propertyId: resolvedPropertyId, roomId: prebookRoomId, form: prebookForm,
          expectedMoveIn: prebookForm.move_in_date,
          files: { idProof: idPayload, photo: photoPayload, payment: paymentPayload },
          transactionId: prebookTransactionId,
        }),
      }, 30000)
      const result = await readApiResponse(response, 'Pre-booking submission failed')
      if (!response.ok) throw new Error(result.error || 'Submission failed')
      toast.success('Pre-booking request sent! Owner will verify payment and approve.')
      setShowPrebookPaymentModal(false)
      setPrebookForm({ name: '', phone: '', email: '', move_in_date: '', message: '' })
      setPrebookRoomId(null); setPrebookIdProof(null); setPrebookPhoto(null)
      setPrebookPaymentScreenshot(null); setPrebookTransactionId(''); setAgreeTerms(false)
      return

      const idProofUrl = await uploadFile(prebookIdProof, 'prebook_id')
      const photoUrl = await uploadFile(prebookPhoto, 'prebook_photo')
      const screenshotUrl = await uploadFile(prebookPaymentScreenshot, 'prebook_pay')

      const prebookData = {
        property_id: id,
        room_id: prebookRoomId,
        user_id: null,
        name: prebookForm.name.trim(),
        phone: cleanPhone,
        email: prebookForm.email.trim(),
        message: prebookForm.message?.trim() || null,
        expected_move_in_date: prebookForm.move_in_date,
        id_proof: idProofUrl,
        photo: photoUrl,
        status: 'pending',
        payment_status: 'pending',
        pre_booking_fee_amount: ownerSettings.pre_booking_fee,
        payment_screenshot: screenshotUrl,
        payment_transaction_id: prebookTransactionId || null,
        created_at: new Date().toISOString()
      }
      const { error } = await supabase.from('pre_bookings').insert(prebookData)
      if (error) throw error
      toast.success('Pre‑booking request sent! Owner will verify payment and approve.')
      setShowPrebookPaymentModal(false)
      setPrebookForm({ name: '', phone: '', email: '', move_in_date: '', message: '' })
      setPrebookRoomId(null)
      setPrebookIdProof(null)
      setPrebookPhoto(null)
      setPrebookPaymentScreenshot(null)
      setPrebookTransactionId('')
      setAgreeTerms(false)
    } catch (error) {
      console.error('Pre-booking error:', error)
      toast.error('Failed to submit pre‑booking: ' + (error.message || 'Unknown error'))
    } finally {
      setPrebookPaymentSubmitting(false)
      setPrebookPaymentProgress('')
    }
  }

  const nextImage = () => {
    if (property?.photos && currentImageIndex < property.photos.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
    }
  }

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1)
    }
  }

  // Reset form when closing payment modal (optional)
  const closePaymentModal = () => {
    if (paymentSubmitting) return
    setShowPaymentModal(false)
    // Optionally clear payment screenshot but keep form data? We'll keep it for retry.
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading property details...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50"><div className="max-w-md text-center bg-white p-8 rounded-2xl border"><p className="text-red-600 mb-5">{loadError}</p><button onClick={loadData} className="btn-primary">Try again</button></div></div>
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Property not found</h1>
          <Link href="/" className="text-slate-600 hover:text-slate-800 inline-flex items-center gap-2">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const hasNoRooms = rooms.length === 0
  const isApplyFormValid = applyForm.name && phoneValid && emailValid && idProof && photo
  const isPrebookFormValid = prebookForm.name && prebookPhoneValid && prebookEmailValid && prebookIdProof && prebookPhoto && agreeTerms && prebookForm.move_in_date
  const city = property.city || 'India'
  const propertyType = getPropertyTypeLabel(property.property_type)
  const amenities = Array.isArray(property.amenities) ? property.amenities.filter(Boolean) : []
  const rents = rooms.map(room => Number(room.monthly_rent)).filter(Number.isFinite)
  const minRent = rents.length ? Math.min(...rents) : null
  const maxRent = rents.length ? Math.max(...rents) : null
  const rentText = minRent == null ? 'Contact the property for current rent' : minRent === maxRent ? `${formatCurrency(minRent)} per month` : `${formatCurrency(minRent)}–${formatCurrency(maxRent)} per month`
  const roomTypes = [...new Set(rooms.map(room => getSharingDetails(room.sharing_type)?.label).filter(Boolean))]
  const availableSlots = rooms.reduce((total, room) => total + Math.max(0, Number(room.capacity || 0) - Number(room.current_occupants || 0)), 0)
  const genderLabel = property.property_type === 'boys' ? 'Boys' : property.property_type === 'girls' ? 'Girls' : 'Co-living'
  const locality = property.address || city
  const fullAddress = property.formatted_address || [property.address, property.city, property.pincode].filter(Boolean).join(', ')
  const foodAmenity = amenities.find(amenity => /food|meal|mess/i.test(amenity))
  const seoTitle = `${property.name} in ${city} | Rooms, Rent & Hostel Details - HostelSet`
  const seoDescription = `View ${property.name} in ${city} on HostelSet. Check room details, rent, amenities, location, and apply online.`
  const canonicalUrl = `${SITE_URL}${propertyPublicPath(property)}`
  const absoluteImage = (() => {
    const candidate = property.photos?.[0] || '/brand/logo-primary.png'
    try { return new URL(candidate, SITE_URL).toString() }
    catch { return `${SITE_URL}/brand/logo-primary.png` }
  })()
  const imageAlt = `${property.name} hostel in ${city}`
  const lodgingSchema = {
    '@context': 'https://schema.org', '@type': ['LodgingBusiness', 'LocalBusiness'], name: property.name,
    description: property.description || seoDescription,
    image: property.photos?.length ? property.photos.map(photo => { try { return new URL(photo, SITE_URL).toString() } catch { return absoluteImage } }) : [absoluteImage],
    url: canonicalUrl,
    address: { '@type': 'PostalAddress', streetAddress: property.formatted_address || property.address, addressLocality: city, postalCode: property.pincode || undefined, addressCountry: 'IN' },
    telephone: property.contact_number || undefined,
    amenityFeature: amenities.map(amenity => ({ '@type': 'LocationFeatureSpecification', name: amenity, value: true })),
    geo: Number.isFinite(property.latitude) && Number.isFinite(property.longitude) ? { '@type': 'GeoCoordinates', latitude: property.latitude, longitude: property.longitude } : undefined,
    priceRange: minRent == null ? undefined : rentText,
    makesOffer: rooms.map(room => ({
      '@type': 'Offer',
      name: `${getSharingDetails(room.sharing_type)?.label || 'Room'} at ${property.name}`,
      price: Number(room.monthly_rent),
      priceCurrency: 'INR',
      availability: Number(room.current_occupants || 0) < Number(room.capacity || 0) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: canonicalUrl,
    })),
    subjectOf: property.photos?.map((photo, index) => ({ '@type': 'ImageObject', contentUrl: (() => { try { return new URL(photo, SITE_URL).toString() } catch { return absoluteImage } })(), caption: `${imageAlt} - photo ${index + 1}` })),
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Properties', item: `${SITE_URL}/properties` },
      { '@type': 'ListItem', position: 3, name: property.name, item: canonicalUrl },
    ],
  }
  const jsonLd = JSON.stringify([lodgingSchema, breadcrumbSchema]).replace(/</g, '\\u003c')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HostelSet" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={absoluteImage} />
        <meta property="og:image:alt" content={imageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:image" content={absoluteImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </Head>
      {/* Header – unchanged */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo />
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle className="hidden sm:inline-flex text-slate-700 dark:text-white border-slate-200 dark:border-white/20 bg-white dark:bg-white/10" />
              <Link href="/login" className="text-gray-600 hover:text-slate-800 transition">Login / Signup</Link>
              <Link href="/owner/register-property" className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-700 transition shadow-md">
                List Property
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/properties" className="flex items-center gap-2 text-gray-500 hover:text-slate-800 mb-6 transition group">
          <span className="group-hover:-translate-x-1 transition">←</span> Back to Search
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">{property.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">📍 {property.address}, {property.city}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            {property.rating && property.total_reviews > 0 && <span className="flex items-center gap-1">⭐ {property.rating} ({property.total_reviews} reviews)</span>}
          </div>
        </div>

        {/* Gallery – unchanged */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-xl">
          <div className="relative bg-gray-900/5 backdrop-blur-sm">
            {property.photos && property.photos.length > 0 ? (
              <>
                <div className="relative h-[260px] w-full sm:h-[400px] md:h-[500px]"><Image loader={propertyImageLoader} unoptimized src={property.photos[currentImageIndex]} alt={imageAlt} fill priority sizes="(max-width: 768px) 100vw, 1152px" className="object-cover" /></div>
                {property.photos.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition backdrop-blur-sm">←</button>
                    <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition backdrop-blur-sm">→</button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {property.photos.map((_, i) => (
                        <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full transition ${i === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-[260px] sm:h-[400px] flex items-center justify-center text-6xl sm:text-8xl bg-gradient-to-br from-slate-100 to-gray-100">🏠</div>
            )}
          </div>
          {property.photos && property.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {property.photos.map((photo, i) => (
                <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === currentImageIndex ? 'border-slate-800' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <Image loader={propertyImageLoader} unoptimized src={photo} alt={`${imageAlt} - photo ${i + 1}`} width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs – unchanged */}
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('rooms')} className={`px-6 py-3 font-semibold transition relative ${activeTab === 'rooms' ? 'text-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>
            🏠 Rooms & Availability
            {activeTab === 'rooms' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800 rounded-full"></span>}
          </button>
          <button onClick={() => setActiveTab('amenities')} className={`px-6 py-3 font-semibold transition relative ${activeTab === 'amenities' ? 'text-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>
            ✨ Amenities
            {activeTab === 'amenities' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800 rounded-full"></span>}
          </button>
          <button onClick={() => setActiveTab('about')} className={`px-6 py-3 font-semibold transition relative ${activeTab === 'about' ? 'text-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>
            📖 About
            {activeTab === 'about' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800 rounded-full"></span>}
          </button>
        </div>

        {/* Rooms Tab – unchanged except for the "Apply Now" button which now just opens apply modal */}
        {activeTab === 'rooms' && (
          <>
            {hasNoRooms ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-100">
                <div className="text-5xl mb-4">🏠</div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">No Rooms Available</h3>
                <p className="text-gray-500">This property currently has no rooms listed. Please check back later.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((room) => {
                  const sharing = getSharingDetails(room.sharing_type)
                  const isAvailable = room.current_occupants < room.capacity
                  const availableSlots = room.capacity - room.current_occupants
                  const roomVacate = vacateInfo[room.id]
                  const hasApprovedPrebooking = approvedPrebookings[room.id]
                  const isPrebookable = Boolean(roomVacate) && !hasApprovedPrebooking
                  const isReserved = hasApprovedPrebooking

                  let badgeText = ''
                  let badgeColor = ''
                  if (isAvailable && !isReserved) {
                    badgeText = `${availableSlots} slot available`
                    badgeColor = 'bg-green-100 text-green-700'
                  } else if (isReserved) {
                    badgeText = 'Reserved'
                    badgeColor = 'bg-purple-100 text-purple-700'
                  } else if (isPrebookable) {
                    badgeText = 'Pre‑bookable'
                    badgeColor = 'bg-blue-100 text-blue-700'
                  } else {
                    badgeText = 'Full'
                    badgeColor = 'bg-gray-100 text-gray-500'
                  }

                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-150 overflow-hidden ${
                        isAvailable && !isReserved ? 'border-green-200 hover:border-green-400' : (isPrebookable ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 opacity-70')
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3>
                            <p className="text-sm text-gray-500 mt-1">{sharing.label} {sharing.icon}</p>
                            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${room.room_audience === 'boys' ? 'bg-blue-100 text-blue-700' : room.room_audience === 'girls' ? 'bg-pink-100 text-pink-700' : 'bg-violet-100 text-violet-700'}`}>{room.room_audience === 'boys' ? 'Boys Room' : room.room_audience === 'girls' ? 'Girls Room' : 'Co-living Room'}</span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <div className="mb-4">
                          <p className="text-3xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}</p>
                          <p className="text-gray-400 text-sm">per month</p>
                          <p className="text-gray-400 text-sm mt-1">Application deposit: {formatCurrency(3000)}</p>
                        </div>
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-500">Occupancy</span>
                            <span className="text-slate-600">{room.current_occupants}/{room.capacity}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-slate-600 h-2 rounded-full transition-all duration-150" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }} />
                          </div>
                        </div>
                        {isPrebookable && !isReserved && (
                          <div className="mt-2 mb-2">
                            <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                              {roomVacate.daysLeft > 1 ? `Vacates in ${roomVacate.daysLeft} days` : roomVacate.daysLeft === 1 ? 'Vacates tomorrow' : 'Ready to vacate'}
                            </span>
                          </div>
                        )}
                        {isReserved ? (
                          <button disabled className="w-full bg-gray-400 text-white py-3 rounded-xl font-semibold cursor-not-allowed">
                            Reserved (Pre‑booked)
                          </button>
                        ) : isAvailable ? (
                          <button onClick={() => { setSelectedRoom(room.id); setShowApplyModal(true) }} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition transform hover:-translate-y-0.5 duration-200">
                            Apply Now →
                          </button>
                        ) : isPrebookable ? (
                          <button onClick={() => openPrebookModal(room.id, roomVacate.vacateDate)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition transform hover:-translate-y-0.5 duration-200">
                            📅 Pre‑book this room
                          </button>
                        ) : (
                          <button disabled className="w-full bg-gray-300 text-gray-500 py-3 rounded-xl font-semibold cursor-not-allowed">
                            Full – Not available
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Amenities Tab – unchanged */}
        {activeTab === 'amenities' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Amenities & Facilities</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(property.amenities || []).map((amenity, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About Tab – unchanged */}
        {activeTab === 'about' && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-slate-800 mb-4">About this Property</h2>
            <p className="text-gray-600 leading-relaxed">{property.description || 'No description provided.'}</p>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-slate-800 mb-2">Property Details</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Property Type</span>
                  <span className="text-slate-700">{getPropertyTypeLabel(property.property_type)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Total Rooms</span>
                  <span className="text-slate-700">{rooms.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="text-slate-700">{property.city}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Listed Since</span>
                  <span className="text-slate-700">{new Date(property.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="property-answers-title">
          <h2 id="property-answers-title" className="text-2xl font-bold text-slate-800">What is this property?</h2>
          <p className="mt-3 text-slate-600">{property.description || `${property.name} is a ${propertyType.toLowerCase()} accommodation listing in ${city}. Review the available rooms, rent and facilities below before applying.`}</p>

          <dl className="mt-6 grid gap-x-8 gap-y-3 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-slate-700">Hostel type and gender</dt><dd className="mt-1 text-slate-600">{propertyType} · {genderLabel}</dd></div>
            <div><dt className="font-semibold text-slate-700">City</dt><dd className="mt-1 text-slate-600">{city}</dd></div>
            <div><dt className="font-semibold text-slate-700">Locality</dt><dd className="mt-1 text-slate-600">{locality}</dd></div>
            <div><dt className="font-semibold text-slate-700">Pin code</dt><dd className="mt-1 text-slate-600">{property.pincode || 'Not provided'}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-700">Full address</dt><dd className="mt-1 text-slate-600">{fullAddress}</dd></div>
            <div><dt className="font-semibold text-slate-700">Nearby landmark</dt><dd className="mt-1 text-slate-600">{property.nearby_landmark || 'No landmark has been listed.'}</dd></div>
            <div><dt className="font-semibold text-slate-700">Map coordinates</dt><dd className="mt-1 text-slate-600">{Number.isFinite(property.latitude) && Number.isFinite(property.longitude) ? `${property.latitude}, ${property.longitude}` : 'Not available'}</dd></div>
            <div><dt className="font-semibold text-slate-700">Room types</dt><dd className="mt-1 text-slate-600">{roomTypes.length ? roomTypes.join(', ') : 'No rooms currently listed'}</dd></div>
            <div><dt className="font-semibold text-slate-700">Rent range</dt><dd className="mt-1 text-slate-600">{rentText}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold text-slate-700">Amenities</dt><dd className="mt-1 text-slate-600">{amenities.length ? amenities.join(', ') : 'No amenities have been listed.'}</dd></div>
          </dl>

          <div className="mt-8 grid gap-7 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Who is it suitable for?</h3>
              <p className="mt-2 text-slate-600">This listing is marked for {genderLabel.toLowerCase()} accommodation. Applicants should review the individual room audience and property rules before applying.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Is this hostel available?</h3>
              <p className="mt-2 text-slate-600">{availableSlots > 0 ? `Yes. The currently listed rooms show ${availableSlots} available slot${availableSlots === 1 ? '' : 's'} in total.` : 'No immediate room slots are shown. A room may still offer pre-booking when an approved vacate date is listed.'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">What room types are available?</h3>
              <p className="mt-2 text-slate-600">{rooms.length ? `${rooms.length} room option${rooms.length === 1 ? '' : 's'} ${roomTypes.length ? `include ${roomTypes.join(', ')}` : 'are listed'}.` : 'No rooms are currently listed for this property.'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">How much is the rent?</h3>
              <p className="mt-2 text-slate-600">The current listed room rent is {rentText}. Check the selected room and confirm current charges with the owner before joining.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">What amenities are included?</h3>
              <p className="mt-2 text-slate-600">{amenities.length ? `The owner has listed: ${amenities.join(', ')}.` : 'The owner has not listed any amenities yet.'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Is food included?</h3>
              <p className="mt-2 text-slate-600">{foodAmenity ? `${foodAmenity} is included in the amenities listed by the owner. Confirm meal timings and charges directly with the owner.` : 'Food is not specified as an included amenity in this listing. Ask the owner before applying.'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">How can I apply?</h3>
              <p className="mt-2 text-slate-600">Choose an available room, select Apply Now, provide the requested applicant details and documents, then submit the application payment reference and proof for owner review.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">How does payment work?</h3>
              <p className="mt-2 text-slate-600">Pay using the owner’s displayed UPI details, then submit the UPI transaction reference and screenshot. The owner manually verifies the proof. Room rent is separate from the application/security deposit unless clearly stated otherwise.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">What documents are required?</h3>
              <p className="mt-2 text-slate-600">The application asks for an ID proof such as Aadhaar or PAN, a passport-size photo, and payment proof with the UPI transaction reference.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">How do I contact the owner?</h3>
              <p className="mt-2 text-slate-600">{property.contact_number ? `The public contact number listed for this property is ${property.contact_number}.` : 'A public owner contact number is not listed. Submit an application or use HostelSet support for platform assistance.'}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">How far is it from major landmarks?</h3>
              <p className="mt-2 text-slate-600">{property.nearby_landmark ? `${property.nearby_landmark} is the nearby landmark supplied by the owner. Use the map directions below to check the exact route and distance.` : 'No major landmark distance has been supplied. Use the map and directions below to calculate the route from your destination.'}</p>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <Link href="/properties" className="font-semibold text-indigo-700 hover:text-indigo-800">Browse all properties</Link>
            {similarProperties.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-slate-800">More properties in {city}</h3>
                <div className="mt-2 flex flex-wrap gap-3">
                  {similarProperties.map(similar => (
                    <Link key={similar.id} href={propertyPublicPath(similar)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">{similar.name}</Link>
                  ))}
                </div>
              </div>
            )}
            {similarProperties.some(similar => similar.address || similar.formatted_address) && <div className="mt-4"><h3 className="font-semibold text-slate-800">Nearby localities</h3><div className="mt-2 flex flex-wrap gap-3">{similarProperties.filter(similar => similar.address || similar.formatted_address).map(similar => <Link key={`locality-${similar.id}`} href={propertyPublicPath(similar)} className="text-sm font-medium text-indigo-700 underline">{similar.address || similar.formatted_address}</Link>)}</div></div>}
            <div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/about" className="font-semibold text-indigo-700 hover:text-indigo-800">About HostelSet</Link><Link href="/support" className="font-semibold text-indigo-700 hover:text-indigo-800">Support</Link></div>
          </div>
        </section>

        {Number.isFinite(property.latitude) && Number.isFinite(property.longitude) && (
          <section className="mt-10 border-t border-slate-200 pt-8" aria-labelledby="property-location-title">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 id="property-location-title" className="text-lg font-bold text-slate-800">Find this property</h2><p className="text-sm text-slate-500">{property.formatted_address || property.address}</p></div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`} target="_blank" rel="noreferrer" className="rounded-full bg-slate-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700">Open Directions</a>
            </div>
            <NearbyHostelMap properties={[property]} userLocation={null} compact />
          </section>
        )}
      </div>

      {/* ========== MODALS ========== */}

      {/* Apply Modal – unchanged except for submitApplication handler */}
      <AnimatePresence>
        {showApplyModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowApplyModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Apply for Room</h2>
                <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400" value={applyForm.name} onChange={(e) => setApplyForm({...applyForm, name: e.target.value})} />
                <div>
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200 text-gray-600">+91</span>
                    <input 
                      type="tel" 
                      placeholder="Phone Number *" 
                      className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${phoneError ? 'border-red-500 focus:ring-red-400' : 'border-gray-200 focus:ring-slate-400'}`}
                      value={applyForm.phone} 
                      onChange={(e) => setApplyForm({...applyForm, phone: e.target.value})}
                      onBlur={handlePhoneBlur}
                      maxLength={10}
                    />
                  </div>
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                  {checkingPhone && <p className="text-gray-400 text-xs mt-1">Checking...</p>}
                </div>
                <div>
                  <input 
                    type="email" 
                    placeholder="Email * (will be used for login)" 
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${emailError ? 'border-red-500 focus:ring-red-400' : 'border-gray-200 focus:ring-slate-400'}`}
                    value={applyForm.email} 
                    onChange={(e) => setApplyForm({...applyForm, email: e.target.value})}
                    onBlur={handleEmailBlur}
                    required
                  />
                  {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                  {checkingEmail && <p className="text-gray-400 text-xs mt-1">Checking...</p>}
                </div>
                <textarea placeholder="Any message for the owner?" rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none" value={applyForm.message} onChange={(e) => setApplyForm({...applyForm, message: e.target.value})} />
                <div>
                  <label className="block text-sm font-semibold mb-1">ID Proof (Aadhaar/PAN) *</label>
                  <input type="file" accept="image/*,.pdf" onChange={e => handleFileChange(e, setIdProof)} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Passport Size Photo *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPhoto)} className="w-full" />
                </div>
                <button 
                  onClick={submitApplication} 
                  disabled={applySubmitting || !isApplyFormValid || checkingPhone || checkingEmail} 
                  className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applySubmitting ? 'Submitting...' : 'Continue to Payment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Application/security confirmation payment modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closePaymentModal}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Application / Security Deposit</h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">Room {rooms.find(r => r.id === selectedRoom)?.room_number} – {getSharingDetails(rooms.find(r => r.id === selectedRoom)?.sharing_type)?.label}</p>
                <p className="text-lg font-bold mt-1">Application / Security Deposit: {formatCurrency(calculateTotalAmount())}</p>
                <p className="text-sm font-semibold text-red-700 mt-1">Non-refundable</p>
                <p className="text-xs text-gray-600 mt-2">This deposit is only for application/security confirmation. Room rent is separate and must be paid after joining.</p>
              </div>
              {ownerSettings.upi_id && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <p className="text-sm font-semibold">Owner UPI ID: {ownerSettings.upi_id}</p>
                  <a
                    href={`upi://pay?pa=${ownerSettings.upi_id}&pn=HostelSet&am=${calculateTotalAmount()}&cu=INR`}
                    className="mt-2 inline-block bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-700 transition"
                    target="_blank"
                  >
                    Pay with UPI App
                  </a>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">UPI Transaction ID / UTR *</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={transactionId} onChange={e => setTransactionId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Payment Screenshot *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPaymentScreenshot)} className="w-full" />
                </div>
                {!ownerSettings.upi_id && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    Owner payment details are not configured. You cannot submit payment until the owner sets a UPI ID.
                  </div>
                )}
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                  After payment, your application will be submitted. You will receive an email once the owner approves.
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-sm text-red-800">
                  Submitting fake payment proof, wrong UPI transaction ID, or false documents may lead to rejection and legal/cybercrime action.
                </div>
                <button onClick={submitPayment} disabled={paymentSubmitting || !ownerSettings.upi_id} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50">
                  {paymentSubmitting ? paymentProgress || 'Processing...' : 'I Have Paid – Submit'}
                </button>
                <button onClick={closePaymentModal} disabled={paymentSubmitting} className="w-full text-center text-gray-500 text-sm disabled:opacity-50">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pre‑booking modals – unchanged */}
      <AnimatePresence>
        {showPrebookModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPrebookModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Pre‑book Room</h2>
                <button onClick={() => setShowPrebookModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" value={prebookForm.name} onChange={e => setPrebookForm({...prebookForm, name: e.target.value})} />
                <div>
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200 text-gray-600">+91</span>
                    <input 
                      type="tel" 
                      placeholder="Phone Number *" 
                      className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${prebookPhoneError ? 'border-red-500 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
                      value={prebookForm.phone} 
                      onChange={(e) => setPrebookForm({...prebookForm, phone: e.target.value})}
                      onBlur={handlePrebookPhoneBlur}
                      maxLength={10}
                    />
                  </div>
                  {prebookPhoneError && <p className="text-red-500 text-xs mt-1">{prebookPhoneError}</p>}
                  {prebookCheckingPhone && <p className="text-gray-400 text-xs mt-1">Checking...</p>}
                </div>
                <div>
                  <input 
                    type="email" 
                    placeholder="Email *" 
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${prebookEmailError ? 'border-red-500 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
                    value={prebookForm.email} 
                    onChange={(e) => setPrebookForm({...prebookForm, email: e.target.value})}
                    onBlur={handlePrebookEmailBlur}
                    required
                  />
                  {prebookEmailError && <p className="text-red-500 text-xs mt-1">{prebookEmailError}</p>}
                  {prebookCheckingEmail && <p className="text-gray-400 text-xs mt-1">Checking...</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Expected Move‑in Date *</label>
                  <input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={prebookForm.move_in_date} onChange={e => setPrebookForm({...prebookForm, move_in_date: e.target.value})} min={new Date().toISOString().split('T')[0]} />
                  <p className="text-xs text-gray-400 mt-1">Based on the current tenant’s vacate date.</p>
                </div>
                <textarea placeholder="Any message for the owner?" rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none" value={prebookForm.message} onChange={(e) => setPrebookForm({...prebookForm, message: e.target.value})} />
                <div>
                  <label className="block text-sm font-semibold mb-1">ID Proof (Aadhaar/PAN) *</label>
                  <input type="file" accept="image/*,.pdf" onChange={e => handleFileChange(e, setPrebookIdProof)} className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Passport Size Photo *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPrebookPhoto)} className="w-full" />
                </div>
                <div className="flex items-start gap-2">
                  <input type="checkbox" id="prebookTerms" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-1" />
                  <label htmlFor="prebookTerms" className="text-sm text-gray-600">
                    I agree that the pre‑booking fee of <strong>{formatCurrency(ownerSettings.pre_booking_fee)}</strong> is <strong>non‑refundable</strong>. If I do not move in by the expected date, my booking will be automatically cancelled and the fee will not be returned.
                  </label>
                </div>
                <button 
                  onClick={submitPreBookingForm} 
                  disabled={prebookSubmitting || !isPrebookFormValid || prebookCheckingPhone || prebookCheckingEmail} 
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {prebookSubmitting ? 'Submitting...' : 'Proceed to Payment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrebookPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPrebookPaymentModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Pay Pre‑booking Fee</h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">Room {rooms.find(r => r.id === prebookRoomId)?.room_number}</p>
                <p className="text-lg font-bold mt-1">Non‑refundable Fee: {formatCurrency(ownerSettings.pre_booking_fee)}</p>
                <p className="text-xs text-gray-500 mt-1">This amount will be adjusted against your first month's rent.</p>
                <div className="mt-2 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                  ⚠️ If you do not move in by the expected date, your booking will be cancelled and the fee will not be refunded.
                </div>
              </div>
              {ownerSettings.upi_id && (
                <div className="bg-blue-50 p-3 rounded-lg mb-4">
                  <p className="text-sm font-semibold">Owner UPI ID: {ownerSettings.upi_id}</p>
                  <a
                    href={`upi://pay?pa=${ownerSettings.upi_id}&pn=HostelSet&am=${ownerSettings.pre_booking_fee}&cu=INR`}
                    className="mt-2 inline-block bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-700 transition"
                    target="_blank"
                  >
                    Pay with UPI App
                  </a>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">UPI Transaction ID / UTR *</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={prebookTransactionId} onChange={e => setPrebookTransactionId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Payment Screenshot *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPrebookPaymentScreenshot)} className="w-full" required />
                </div>
                {!ownerSettings.upi_id && (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    Owner payment details are not configured. You cannot submit payment until the owner sets a UPI ID.
                  </div>
                )}
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                  After payment, upload the screenshot and submit. Owner will verify and approve your pre‑booking.
                </div>
                <button onClick={submitPreBookingPayment} disabled={prebookPaymentSubmitting || !ownerSettings.upi_id} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {prebookPaymentSubmitting ? prebookPaymentProgress || 'Submitting...' : 'Submit Payment Proof'}
                </button>
                <button onClick={() => { if (!prebookPaymentSubmitting) setShowPrebookPaymentModal(false) }} disabled={prebookPaymentSubmitting} className="w-full text-center text-gray-500 text-sm disabled:opacity-50">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PublicFooter />
    </div>
  )
}

export async function getStaticPaths() {
  const { data } = await supabase
    .from('properties')
    .select('id, slug')
    .eq('is_active', true)

  return {
    paths: (data || []).map(property => ({ params: { id: property.slug || property.id } })),
    fallback: 'blocking',
  }
}

export async function getStaticProps({ params }) {
  const propertyId = params?.id
  const usesUuid = UUID_PATTERN.test(String(propertyId || ''))
  let propertyQuery = supabase.from('properties').select('*').eq('is_active', true)
  propertyQuery = usesUuid ? propertyQuery.eq('id', propertyId) : propertyQuery.eq('slug', propertyId)
  const propertyResult = await propertyQuery.maybeSingle()

  if (propertyResult.error || !propertyResult.data) {
    return { notFound: true, revalidate: 60 }
  }

  if (usesUuid && propertyResult.data.slug) {
    return { redirect: { destination: propertyPublicPath(propertyResult.data), statusCode: 301 } }
  }

  const [resolvedRoomsResult, resolvedSettingsResult] = await Promise.all([
    supabase.from('rooms').select('*').eq('property_id', propertyResult.data.id).order('room_number'),
    supabase.from('owner_settings').select('upi_id, advance_months, joining_fee, pre_booking_fee').eq('property_id', propertyResult.data.id).maybeSingle(),
  ])

  if (resolvedRoomsResult.error) throw resolvedRoomsResult.error

  let similarProperties = []
  if (propertyResult.data.city) {
    const { data } = await supabase
      .from('properties')
      .select('id, slug, name, city, address, formatted_address')
      .eq('is_active', true)
      .eq('city', propertyResult.data.city)
      .neq('id', propertyResult.data.id)
      .limit(4)
    similarProperties = data || []
  }

  return {
    props: {
      initialProperty: propertyResult.data,
      initialRooms: resolvedRoomsResult.data || [],
      initialSettings: resolvedSettingsResult.error ? null : resolvedSettingsResult.data,
      similarProperties,
    },
    revalidate: 300,
  }
}
