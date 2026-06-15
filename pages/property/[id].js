import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, getSharingDetails, getPropertyTypeLabel, cleanPhoneNumber, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function PropertyDetail() {
  const router = useRouter()
  const { id } = router.query
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [idProof, setIdProof] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('rooms')
  const [ownerSettings, setOwnerSettings] = useState({ upi_id: '', advance_months: 1, joining_fee: 0, pre_booking_fee: 0 })
  const [applySubmitting, setApplySubmitting] = useState(false)

  // Regular payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [transactionId, setTransactionId] = useState('')
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // Pre‑booking state
  const [vacateInfo, setVacateInfo] = useState({})
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

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: propertyData } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()
      setProperty(propertyData)

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', id)
        .order('room_number')
      setRooms(roomsData || [])

      if (propertyData) {
        const { data: settingsData } = await supabase
          .from('owner_settings')
          .select('*')
          .eq('owner_id', propertyData.owner_id)
          .maybeSingle()
        if (settingsData) {
          setOwnerSettings({
            upi_id: settingsData.upi_id || propertyData.owner_upi_id || '',
            advance_months: settingsData.advance_months || 1,
            joining_fee: settingsData.joining_fee || 0,
            pre_booking_fee: settingsData.pre_booking_fee || 999,
          })
        } else if (propertyData.owner_upi_id) {
          setOwnerSettings({
            upi_id: propertyData.owner_upi_id,
            advance_months: 1,
            joining_fee: 0,
            pre_booking_fee: 999,
          })
        }
      }

      await loadVacateInfo(propertyData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVacateInfo = async (propertyData) => {
    if (!propertyData) return
    const { data: vacates } = await supabase
      .from('check_out_requests')
      .select('id, room_id, tenant_name, expected_check_out')
      .eq('property_id', propertyData.id)
      .eq('status', 'approved')
    const info = {}
    const today = new Date()
    vacates?.forEach(v => {
      const vacateDate = new Date(v.expected_check_out)
      const daysLeft = Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24))
      if (daysLeft > 0) {
        info[v.room_id] = { daysLeft, tenantName: v.tenant_name, vacateRequestId: v.id, vacateDate: v.expected_check_out }
      }
    })
    setVacateInfo(info)
  }

  const calculateTotalAmount = () => {
    if (!selectedRoom) return 0
    const room = rooms.find(r => r.id === selectedRoom)
    if (!room) return 0
    const rent = room.monthly_rent
    const advance = rent * ownerSettings.advance_months
    return rent + advance + ownerSettings.joining_fee
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

  const uploadFile = async (file, prefix) => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${file.name.split('.').pop()}`
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file, { cacheControl: '3600' })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('tenant-documents').getPublicUrl(fileName)
    return publicUrl
  }

  // ========== Apply Form Validation ==========
  const validatePhone = async (phone) => {
    const cleanPhone = cleanPhoneNumber(phone)
    if (!cleanPhone || cleanPhone.length !== 10) {
      setPhoneError('Enter a valid 10-digit phone number')
      setPhoneValid(false)
      return false
    }
    setCheckingPhone(true)
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (existingUser) {
        setPhoneError('This phone number is already registered. Please login.')
        setPhoneValid(false)
        return false
      }
      const { data: existingApp } = await supabase
        .from('applications')
        .select('id, status')
        .eq('phone', cleanPhone)
        .eq('property_id', id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      if (existingApp) {
        setPhoneError('You already have a pending application for this property.')
        setPhoneValid(false)
        return false
      }
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
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (existingUser) {
        setEmailError('This email is already registered. Please login.')
        setEmailValid(false)
        return false
      }
      const { data: existingApp } = await supabase
        .from('applications')
        .select('id')
        .eq('email', email)
        .eq('property_id', id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      if (existingApp) {
        setEmailError('An application with this email already exists.')
        setEmailValid(false)
        return false
      }
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

  // ========== Pre‑booking Form Validation (same as apply) ==========
  const validatePrebookPhone = async (phone) => {
    const cleanPhone = cleanPhoneNumber(phone)
    if (!cleanPhone || cleanPhone.length !== 10) {
      setPrebookPhoneError('Enter a valid 10-digit phone number')
      setPrebookPhoneValid(false)
      return false
    }
    setPrebookCheckingPhone(true)
    try {
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
        .eq('property_id', id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      if (existingPrebook) {
        setPrebookPhoneError('You already have a pending pre‑booking for this property.')
        setPrebookPhoneValid(false)
        return false
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
        .eq('property_id', id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      if (existingPrebook) {
        setPrebookEmailError('You already have a pending pre‑booking for this property.')
        setPrebookEmailValid(false)
        return false
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

    setApplySubmitting(true)
    try {
      const idUrl = await uploadFile(idProof, 'id')
      const photoUrl = await uploadFile(photo, 'photo')

      const { error } = await supabase.from('applications').insert({
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

      if (error) {
        if (error.message.includes('duplicate key value') || error.code === '23505') {
          toast.error('You already have a pending application or active tenancy in this property.')
        } else {
          throw error
        }
        setApplySubmitting(false)
        return
      }

      setShowApplyModal(false)
      setPaymentScreenshot(null)
      setTransactionId('')
      setShowPaymentModal(true)
    } catch (error) {
      console.error('Application error:', error)
      toast.error('Failed to submit application: ' + error.message)
    } finally {
      setApplySubmitting(false)
    }
  }

  const submitPayment = async () => {
    if (!paymentScreenshot) {
      toast.error('Please upload payment screenshot')
      return
    }
    setPaymentSubmitting(true)
    try {
      const screenshotUrl = await uploadFile(paymentScreenshot, 'pay')
      const cleanPhone = cleanPhoneNumber(applyForm.phone)

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

        await supabase.auth.resetPasswordForEmail(applyForm.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }).catch(e => console.warn('Reset email not sent:', e))
      }

      const totalAmount = calculateTotalAmount()
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
        total_paid: totalAmount,
        rent_status: 'paid',
        move_in_date: new Date().toISOString().split('T')[0],
        status: 'payment_pending',
        payment_screenshot: screenshotUrl,
        upi_transaction_id: transactionId,
      })
      if (tenantError) {
        if (tenantError.message.includes('duplicate key value') || tenantError.code === '23505') {
          toast.error('You already have an active or pending tenancy in this property.')
        } else {
          throw tenantError
        }
        setPaymentSubmitting(false)
        return
      }

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
          payment_method: 'advance',
          status: 'success',
          upi_transaction_id: transactionId || null,
          payment_screenshot: screenshotUrl,
        })
      }

      const newOccupants = room.current_occupants + 1
      const newStatus = newOccupants >= room.capacity ? 'occupied' : 'vacant'
      await supabase.from('rooms').update({
        current_occupants: newOccupants,
        status: newStatus,
      }).eq('id', selectedRoom)

      toast.success(
        `🎉 Account created! Check your email (${applyForm.email}) to set your password.`,
        { duration: 10000 }
      )

      setShowPaymentModal(false)
      setTimeout(() => router.push('/login'), 10000)
    } catch (error) {
      console.error('Payment submission error:', error)
      toast.error('Something went wrong: ' + error.message)
    } finally {
      setPaymentSubmitting(false)
    }
  }

  // ========== PRE‑BOOKING FLOW (No login required, creates user during payment) ==========
  const openPrebookModal = (roomId, vacateDate) => {
    setPrebookRoomId(roomId)
    setPrebookForm({
      name: '',
      phone: '',
      email: '',
      move_in_date: vacateDate || '',
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
    // Validate phone/email against existing users
    const phoneOk = await validatePrebookPhone(prebookForm.phone)
    const emailOk = await validatePrebookEmail(prebookForm.email)
    if (!phoneOk || !emailOk) {
      toast.error('Please correct the errors before proceeding')
      return
    }
    // Close the form modal and open payment modal
    setShowPrebookModal(false)
    setShowPrebookPaymentModal(true)
  }

  const submitPreBookingPayment = async () => {
    if (!prebookPaymentScreenshot) {
      toast.error('Please upload payment screenshot')
      return
    }
    const cleanPhone = cleanPhoneNumber(prebookForm.phone)
    setPrebookPaymentSubmitting(true)
    try {
      // 1. Create or get user account
      let userId
      const existingUser = await findExistingUser(cleanPhone, prebookForm.email)
      
      if (existingUser) {
        userId = existingUser.id
        await supabase.from('users').update({
          full_name: prebookForm.name,
          email: prebookForm.email,
          phone: cleanPhone,
        }).eq('id', userId)
      } else {
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).charAt(0).toUpperCase()
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: prebookForm.email,
          password: tempPassword,
          options: { data: { full_name: prebookForm.name, role: 'tenant', phone: cleanPhone } }
        })
        if (authError) throw authError
        userId = authData.user.id
        await supabase.from('users').insert({
          id: userId,
          email: prebookForm.email,
          full_name: prebookForm.name,
          phone: cleanPhone,
          role: 'tenant',
          is_active: true
        })
        // Send password reset email
        await supabase.auth.resetPasswordForEmail(prebookForm.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }).catch(e => console.warn('Reset email not sent:', e))
      }

      // 2. Upload documents
      const idProofUrl = await uploadFile(prebookIdProof, 'prebook_id')
      const photoUrl = await uploadFile(prebookPhoto, 'prebook_photo')
      const screenshotUrl = await uploadFile(prebookPaymentScreenshot, 'prebook_pay')

      // 3. Insert pre‑booking record with valid user_id
      const prebookData = {
        property_id: id,
        room_id: prebookRoomId,
        user_id: userId,
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
      
      toast.success('Pre‑booking request sent! Owner will verify payment and approve. Check your email to set password.')
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

  const isApplyFormValid = applyForm.name && phoneValid && emailValid && idProof && photo
  const isPrebookFormValid = prebookForm.name && prebookPhoneValid && prebookEmailValid && prebookIdProof && prebookPhoto && agreeTerms && prebookForm.move_in_date

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">HOSTELSET</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-slate-800 transition">Login</Link>
              <Link href="/owner/register-property" className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-700 transition shadow-md">
                List Property
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-slate-800 mb-6 transition group">
          <span className="group-hover:-translate-x-1 transition">←</span> Back to Search
        </button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">{property.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">📍 {property.address}, {property.city}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="flex items-center gap-1">⭐ {property.rating || '4.8'} ({property.total_reviews || 120} reviews)</span>
          </div>
        </div>

        {/* Gallery */}
        <div className="mb-8 rounded-2xl overflow-hidden shadow-xl">
          <div className="relative bg-gray-900/5 backdrop-blur-sm">
            {property.photos && property.photos.length > 0 ? (
              <>
                <img src={property.photos[currentImageIndex]} alt={property.name} className="w-full h-[400px] md:h-[500px] object-cover" />
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
              <div className="w-full h-[400px] flex items-center justify-center text-8xl bg-gradient-to-br from-slate-100 to-gray-100">🏠</div>
            )}
          </div>
          {property.photos && property.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {property.photos.map((photo, i) => (
                <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === currentImageIndex ? 'border-slate-800' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
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

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const sharing = getSharingDetails(room.sharing_type)
              const isAvailable = room.current_occupants < room.capacity
              const availableSlots = room.capacity - room.current_occupants
              const roomVacate = vacateInfo[room.id]
              const isPrebookable = roomVacate && roomVacate.daysLeft > 0
              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${
                    isAvailable ? 'border-green-200 hover:border-green-400' : (isPrebookable ? 'border-blue-200 hover:border-blue-400' : 'border-gray-200 opacity-70')
                  }`}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3>
                        <p className="text-sm text-gray-500 mt-1">{sharing.label} {sharing.icon}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isAvailable ? 'bg-green-100 text-green-700' : (isPrebookable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')
                      }`}>
                        {isAvailable ? `${availableSlots} slot available` : (isPrebookable ? 'Pre‑bookable' : 'Full')}
                      </span>
                    </div>
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}</p>
                      <p className="text-gray-400 text-sm">per month</p>
                      <p className="text-gray-400 text-sm mt-1">Deposit: {formatCurrency(room.deposit_amount || 0)}</p>
                    </div>
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Occupancy</span>
                        <span className="text-slate-600">{room.current_occupants}/{room.capacity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-slate-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }} />
                      </div>
                    </div>
                    {isPrebookable && (
                      <div className="mt-2 mb-2">
                        <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">
                          🚪 Vacates in {roomVacate.daysLeft} days
                        </span>
                      </div>
                    )}
                    {isAvailable ? (
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

        {/* Amenities Tab */}
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

        {/* About Tab */}
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
      </div>

      {/* ========== MODALS ========== */}

      {/* Apply Modal */}
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

      {/* Regular Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Complete Payment</h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">Room {rooms.find(r => r.id === selectedRoom)?.room_number} – {getSharingDetails(rooms.find(r => r.id === selectedRoom)?.sharing_type)?.label}</p>
                <p className="text-lg font-bold mt-1">Total Amount: {formatCurrency(calculateTotalAmount())}</p>
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
                  <label className="block text-sm font-semibold mb-1">UPI Transaction ID (optional)</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={transactionId} onChange={e => setTransactionId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Payment Screenshot *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPaymentScreenshot)} className="w-full" />
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                  After payment, your account will be created instantly and you can log in.
                </div>
                <button onClick={submitPayment} disabled={paymentSubmitting} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50">
                  {paymentSubmitting ? 'Processing...' : 'I Have Paid – Submit'}
                </button>
                <button onClick={() => setShowPaymentModal(false)} className="w-full text-center text-gray-500 text-sm">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pre‑booking Form Modal (Step 1) */}
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

      {/* Pre‑booking Payment Modal (Step 2) */}
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
                  <label className="block text-sm font-semibold mb-1">UPI Transaction ID (optional)</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={prebookTransactionId} onChange={e => setPrebookTransactionId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Payment Screenshot *</label>
                  <input type="file" accept="image/*" onChange={e => handleFileChange(e, setPrebookPaymentScreenshot)} className="w-full" required />
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                  After payment, upload the screenshot and submit. Owner will verify and approve your pre‑booking. A password set email will be sent to your email.
                </div>
                <button onClick={submitPreBookingPayment} disabled={prebookPaymentSubmitting} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {prebookPaymentSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
                <button onClick={() => setShowPrebookPaymentModal(false)} className="w-full text-center text-gray-500 text-sm">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white/50 backdrop-blur-sm border-t border-gray-100 mt-12 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 HOSTELSET. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
