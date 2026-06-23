import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'

// ---------------- MODULAR IMPORTS ----------------
import { useTenant, TenantProvider } from '../../context/TenantContext'
import { useNotices } from '../../hooks/useNotices'
import { useVacate } from '../../hooks/useVacate'
import { useComplaints } from '../../hooks/useComplaints'
import { usePayments } from '../../hooks/usePayments'
import { useRoomChange } from '../../hooks/useRoomChange'
// ------------------------------------------------

import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils'

// Content Components (static)
import OverviewSection from '../../components/tenant/OverviewSection'
import RoommatesSection from '../../components/tenant/RoommatesSection'
import NoticesSection from '../../components/tenant/NoticesSection'
import ComplaintsSection from '../../components/tenant/ComplaintsSection'
import PaymentsSection from '../../components/tenant/PaymentsSection'

// Lazy-load Modal Components
const PayRentModal = dynamic(() => import('../../components/tenant/modals/PayRentModal'), { ssr: false })
const ComplaintModal = dynamic(() => import('../../components/tenant/modals/ComplaintModal'), { ssr: false })
const VacateModal = dynamic(() => import('../../components/tenant/modals/VacateModal'), { ssr: false })
const ProfileModal = dynamic(() => import('../../components/tenant/modals/ProfileModal'), { ssr: false })
const RoomChangeModal = dynamic(() => import('../../components/tenant/modals/RoomChangeModal'), { ssr: false })
const ScreenshotModal = dynamic(() => import('../../components/tenant/modals/ScreenshotModal'), { ssr: false })

export default function TenantDashboard() {
  // ---------------- MODULAR HOOKS ----------------
  const core = useTenant() || {}; // SAFETY FALLBACK added here
  const { tenant, room, property, owner, roommates, loading, refreshData, setTenant } = core;
  
  const { notices } = useNotices(tenant);
  const { existingVacateRequest, cancelVacateRequest } = useVacate(tenant, setTenant);
  const { complaints, submitComplaint, deleteComplaint } = useComplaints(tenant);
  
  const { 
    paymentHistory, 
    paymentLoading, 
    ownerUpiId, 
    ownerUpiPhone, 
    submitPaymentWithProof 
  } = usePayments(tenant, refreshData);

  const {
    pendingRoomChangeRequest,
    availableRooms,
    showRoomChangeModal,
    setShowRoomChangeModal,
    selectedNewRoom,
    setSelectedNewRoom,
    roomChangeReason,
    setRoomChangeReason,
    openRoomChangeModal,
    submitRoomChangeRequest
  } = useRoomChange(tenant, refreshData);
  // ------------------------------------------------

  // ----- UI States remaining -----
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showVacateModal, setShowVacateModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title:'', description:'', priority:'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date:'', reason:'', rating:0, review:'' })
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name:'', phone:'', email:'' })
  const [ratingHover, setRatingHover] = useState(0)
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [paymentTransactionId, setPaymentTransactionId] = useState('')
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState('')

  // ----- Helper Functions -----
  const initiateUPIPayment = (upiId, amount) => {
    const cleanUpi = upiId.trim()
    if (!cleanUpi) { toast.error('Owner UPI ID not available'); return }
    const payee = encodeURIComponent(cleanUpi)
    const payeeName = encodeURIComponent('HostelSet Rent')
    const amt = encodeURIComponent(amount)
    const cu = encodeURIComponent('INR')
    const tr = encodeURIComponent(`RENT_${Date.now()}`)
    const tn = encodeURIComponent(`Rent payment for ${tenant?.name||'tenant'}`)
    const upiUrl = `upi://pay?pa=${payee}&pn=${payeeName}&am=${amt}&cu=${cu}&tr=${tr}&tn=${tn}`
    window.location.href = upiUrl
    setTimeout(() => {
      if (document.hasFocus()) {
        navigator.clipboard.writeText(cleanUpi)
        toast.error('Unable to open UPI app. UPI ID copied.', { duration:5000 })
      }
    }, 2500)
  }
  const copyUpiId = (upiId) => { navigator.clipboard.writeText(upiId); toast.success('UPI ID copied!') }
  const copyUpiPhone = (phone) => { navigator.clipboard.writeText(phone); toast.success('UPI Phone Number copied!') }

  // ----- Profile -----
  const updateProfile = async () => {
    if (isSubmitting) return
    if (!profileForm.name) { toast.error('Name is required'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('tenants').update({ name:profileForm.name, phone:profileForm.phone, email:profileForm.email }).eq('id', tenant.id)
      if (error) throw error
      toast.success('Profile updated successfully!')
      setEditProfile(false)
      await refreshData(true)
    } catch (error) { toast.error('Failed to update profile') }
    finally { setIsSubmitting(false) }
  }

  // ----- Handlers -----
  const requestVacate = async () => {
    if (isSubmitting) return
    if (!vacateForm.expected_date) { toast.error('Please select expected check-out date'); return }
    if (vacateForm.rating === 0) { toast.error('Please rate your experience (1-5 stars)'); return }
    setIsSubmitting(true)
    try {
      const vacateData = {
        tenant_id: tenant.id, tenant_name: tenant.name, property_id: tenant.property_id,
        room_id: tenant.room_id, room_number: room?.room_number || 'N/A',
        expected_check_out: vacateForm.expected_date, reason: vacateForm.reason || null,
        requested_date: new Date().toISOString().split('T')[0], status: 'pending',
        created_at: new Date().toISOString()
      }
      const { error } = await supabase.from('check_out_requests').insert(vacateData)
      if (error) throw new Error(error.message)
      const { error: ratingError } = await supabase.from('ratings').insert({
        tenant_id: tenant.id, property_id: tenant.property_id,
        rating: vacateForm.rating, review: vacateForm.review || null,
        created_at: new Date().toISOString()
      })
      if (ratingError) console.error('Rating submit error:', ratingError)
      toast.success('Vacate request submitted! Owner will review it.')
      setShowVacateModal(false)
      setVacateForm({ expected_date:'', reason:'', rating:0, review:'' })
      await refreshData(true)
    } catch (error) {
      console.error('Vacate request error:', error)
      toast.error('Failed to submit vacate request: ' + error.message)
    } finally { setIsSubmitting(false) }
  }

  const getRentStatus = () => {
    if (!tenant) return { status: 'loading', message: '', daysUntilDue: null, dueDate: null }
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    let monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth())
    if (today.getDate() < joinDate.getDate()) monthsSinceJoin -= 1
    const monthsPaid = Math.floor((tenant.total_paid || 0) / tenant.rent_amount)
    const isCurrentMonthPaid = monthsPaid > monthsSinceJoin
    if (isCurrentMonthPaid || (tenant.pending_amount === 0 && tenant.rent_status === 'paid')) {
      const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate())
      if (nextDueDate.getDate() !== joinDate.getDate()) nextDueDate.setDate(0)
      const daysUntilDue = Math.ceil((nextDueDate - today) / (1000*60*60*24))
      return { status:'paid', message:`Paid ✓ | Next due on ${formatDate(nextDueDate)}`, daysUntilDue, dueAmount:0, dueDate:nextDueDate }
    }
    const expectedDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate())
    if (expectedDate.getDate() !== joinDate.getDate()) expectedDate.setDate(0)
    const daysUntilDue = Math.ceil((expectedDate - today) / (1000*60*60*24))
    const pendingAmount = tenant.pending_amount || tenant.rent_amount
    if (daysUntilDue < 0) { return { status:'overdue', message:`Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueAmount:pendingAmount, dueDate:expectedDate, urgent:true } }
    else if (daysUntilDue === 0) { return { status:'due_today', message:'Due today!', daysUntilDue:0, dueAmount:pendingAmount, dueDate:expectedDate, urgent:true } }
    else if (daysUntilDue <= 5) { return { status:'due_soon', message:`Due in ${daysUntilDue} day${daysUntilDue!==1?'s':''}`, daysUntilDue, dueAmount:pendingAmount, dueDate:expectedDate, urgent:true } }
    else { return { status:'pending', message:`Due on ${formatDate(expectedDate)}`, daysUntilDue, dueAmount:pendingAmount, dueDate:expectedDate, urgent:false } }
  }

  const rentStatus = getRentStatus() || { message: 'Loading...' }
  const isUrgent = rentStatus.urgent && (rentStatus.status === 'due_soon' || rentStatus.status === 'overdue')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 text-gray-600 hover:text-slate-800 transition">
              <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {tenant?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm hidden md:inline">{tenant?.name}</span>
            </button>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className={`rounded-2xl p-6 mb-8 text-white ${rentStatus.status === 'overdue' ? 'bg-gradient-to-r from-red-600 to-red-500 animate-pulse' : rentStatus.status === 'due_soon' ? 'bg-gradient-to-r from-orange-500 to-orange-600 animate-pulse' : 'bg-gradient-to-r from-slate-800 to-slate-700'}`}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back, {tenant?.name}! 👋</h2>
              <p className="text-white/80">Room {room?.room_number} • {getSharingDetails(room?.sharing_type)?.label}</p>
              <p className="text-white/70 text-sm mt-1">{property?.name}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${isUrgent ? 'bg-red-700 text-white animate-pulse' : 'bg-white/20'}`}>{rentStatus.message}</div>
          </div>
          {rentStatus.dueDate && isUrgent && (
            <div className="mt-4 text-center">
              <div className="inline-block bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg text-lg font-bold">⚠️ Next due date: {formatDate(rentStatus.dueDate)} ⚠️</div>
            </div>
          )}
        </div>

        {/* Roommate Vacate Alert */}
        {roommateVacateAlert && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2"><span className="text-xl">🚪</span><div><strong>Vacate Notice:</strong> {roommateVacateAlert.name} will vacate in <strong>{roommateVacateAlert.daysLeft}</strong> days (by {formatDate(roommateVacateAlert.date)}).</div></div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💰</div><div><p className="text-xs text-gray-500">Monthly Rent</p><p className="text-xl font-bold text-slate-800">{formatCurrency(tenant?.rent_amount)}</p></div></div></div>
          <div className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">✅</div><div><p className="text-xs text-gray-500">Total Paid</p><p className="text-xl font-bold text-green-600">{formatCurrency(tenant?.total_paid || 0)}</p></div></div></div>
          <div className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-xl">⚠️</div><div><p className="text-xs text-gray-500">Pending Amount</p><p className="text-xl font-bold text-red-500">{formatCurrency(tenant?.pending_amount || 0)}</p></div></div></div>
          <div className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-xl">👥</div><div><p className="text-xs text-gray-500">Roommates</p><p className="text-xl font-bold text-slate-800">{roommates.length}</p></div></div></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowPaymentModal(true)} disabled={isSubmitting} className="bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">💳 Pay Rent (UPI)</button>
          <button onClick={() => setShowComplaintModal(true)} disabled={isSubmitting} className="border-2 border-orange-300 text-orange-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition disabled:opacity-50">📝 Raise Complaint</button>
          {!pendingRoomChangeRequest ? (
            <button onClick={openRoomChangeModal} disabled={isSubmitting} className="border-2 border-blue-300 text-blue-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-50 transition disabled:opacity-50">🔄 Request Room Change</button>
          ) : (
            <button disabled className="border-2 border-gray-300 text-gray-500 px-6 py-2.5 rounded-full text-sm font-semibold cursor-not-allowed">⏳ Room Change Pending</button>
          )}
          {existingVacateRequest ? (
            <button onClick={cancelVacateRequest} disabled={isSubmitting} className="border-2 border-yellow-500 text-yellow-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-yellow-50 transition disabled:opacity-50">❌ Cancel Vacate Request</button>
          ) : (
            <button onClick={() => setShowVacateModal(true)} disabled={isSubmitting} className="border-2 border-red-300 text-red-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50">🚪 Request Vacate</button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'roommates', 'notices', 'complaints', 'payments'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-slate-700 hover:bg-gray-50'}`}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'roommates' && `👥 Roommates (${roommates.length})`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
              {tab === 'complaints' && `🔧 My Complaints (${complaints.length})`}
              {tab === 'payments' && `💰 Payment History (${paymentHistory.length})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewSection
            tenant={tenant}
            room={room}
            property={property}
            owner={owner}
            pendingRoomChangeRequest={pendingRoomChangeRequest}
          />
        )}
        {activeTab === 'roommates' && <RoommatesSection roommates={roommates} />}
        {activeTab === 'notices' && <NoticesSection notices={notices} />}
        {activeTab === 'complaints' && (
          <ComplaintsSection
            complaints={complaints}
            onDelete={deleteComplaint}
            isSubmitting={isSubmitting}
            onRaiseComplaint={() => setShowComplaintModal(true)}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsSection
            payments={paymentHistory}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}
      </div>

      {/* Modals (lazy‑loaded) */}
      <AnimatePresence>
        {showPaymentModal && (
          <PayRentModal
            tenant={tenant}
            room={room}
            ownerUpiId={ownerUpiId}
            ownerUpiPhone={ownerUpiPhone}
            paymentTransactionId={paymentTransactionId}
            setPaymentTransactionId={setPaymentTransactionId}
            paymentScreenshot={paymentScreenshot}
            setPaymentScreenshot={setPaymentScreenshot}
            paymentLoading={paymentLoading}
            isSubmitting={isSubmitting}
            initiateUPIPayment={initiateUPIPayment}
            copyUpiId={copyUpiId}
            copyUpiPhone={copyUpiPhone}
            submitPaymentWithProof={submitPaymentWithProof}
            onCancel={() => setShowPaymentModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComplaintModal && (
          <ComplaintModal
            complaintForm={complaintForm}
            setComplaintForm={setComplaintForm}
            isSubmitting={isSubmitting}
            onSubmit={submitComplaint}
            onCancel={() => setShowComplaintModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVacateModal && (
          <VacateModal
            vacateForm={vacateForm}
            setVacateForm={setVacateForm}
            ratingHover={ratingHover}
            setRatingHover={setRatingHover}
            isSubmitting={isSubmitting}
            tenant={tenant}
            onSubmit={requestVacate}
            onCancel={() => setShowVacateModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileModal && (
          <ProfileModal
            tenant={tenant}
            room={room}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            editProfile={editProfile}
            setEditProfile={setEditProfile}
            isSubmitting={isSubmitting}
            onUpdate={updateProfile}
            onCancel={() => setShowProfileModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoomChangeModal && (
          <RoomChangeModal
            availableRooms={availableRooms}
            selectedNewRoom={selectedNewRoom}
            setSelectedNewRoom={setSelectedNewRoom}
            roomChangeReason={roomChangeReason}
            setRoomChangeReason={setRoomChangeReason}
            isSubmitting={isSubmitting}
            onSubmit={submitRoomChangeRequest}
            onCancel={() => setShowRoomChangeModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScreenshotModal && screenshotUrl && (
          <ScreenshotModal
            url={screenshotUrl}
            onClose={() => setShowScreenshotModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}