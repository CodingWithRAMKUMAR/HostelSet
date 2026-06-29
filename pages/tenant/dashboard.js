import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

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

// ---------------- THE ACTUAL DASHBOARD CONTENT ----------------
function TenantDashboardContent() {
  const router = useRouter();
  
  // ---------------- MODULAR HOOKS ----------------
  const core = useTenant() || {};
  const { tenant, room, property, owner, roommates, loading, realtimeConnected, roommateVacateAlert, refreshData, setTenant } = core;
  
  const { notices = [] } = useNotices(tenant);
  const { existingVacateRequest, cancelVacateRequest } = useVacate(tenant, setTenant);
  const { complaints = [], submitComplaint: hookSubmitComplaint, deleteComplaint: hookDeleteComplaint } = useComplaints(tenant);
  
  const { 
    paymentHistory = [], 
    paymentLoading, 
    ownerUpiId, 
    ownerUpiPhone, 
    submitPaymentWithProof 
  } = usePayments(tenant, refreshData);

  const {
    pendingRoomChangeRequest,
    availableRooms = [],
    showRoomChangeModal,
    setShowRoomChangeModal,
    selectedNewRoom,
    setSelectedNewRoom,
    roomChangeReason,
    setRoomChangeReason,
    openRoomChangeModal,
    submitRoomChangeRequest
  } = useRoomChange(tenant, refreshData);

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
  const submitComplaint = async () => {
    if (isSubmitting) return
    if (!complaintForm.title || !complaintForm.description) { toast.error('Please fill all fields'); return }
    setIsSubmitting(true)
    const success = await hookSubmitComplaint(complaintForm);
    if (success) {
      setShowComplaintModal(false);
      setComplaintForm({ title:'', description:'', priority:'medium' });
    }
    setIsSubmitting(false);
  };

  const deleteComplaint = async (complaintId) => {
    await hookDeleteComplaint(complaintId);
  };

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
    await supabase.auth.signOut();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    router.push('/login');
  }

  if (loading || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-orange-400">Loading your premium suite...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans">
      
      {/* --- NAVBAR (Premium Onyx & Gold) --- */}
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-6 py-4 shadow-lg border-b-2 border-orange-500/80">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`hidden sm:inline-flex items-center gap-2 text-xs font-semibold ${realtimeConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {tenant?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm hidden md:inline font-medium text-orange-300/80">{tenant?.name}</span>
            </button>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        
        {/* --- WELCOME SECTION (GLASSMORPHISM) --- */}
        <div className="relative overflow-hidden rounded-2xl p-8 mb-8 bg-[#1a1a1a] shadow-xl border border-orange-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
          <div className="flex justify-between items-start flex-wrap gap-4 relative z-10">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Welcome back, <span className="text-orange-400">{tenant?.name}</span>! 👋</h2>
              <p className="text-white/70">Room {room?.room_number} • {getSharingDetails(room?.sharing_type)?.label}</p>
              <p className="text-white/50 text-sm mt-1">{property?.name}</p>
            </div>
            <div className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-lg backdrop-blur-sm ${isUrgent ? 'bg-red-500/90 text-white animate-pulse border border-red-400' : 'bg-white/10 text-white border border-white/20'}`}>
              {rentStatus.message}
            </div>
          </div>
          {rentStatus.dueDate && isUrgent && (
            <div className="mt-4 text-center relative z-10">
              <div className="inline-block bg-black/40 backdrop-blur-sm px-5 py-2.5 rounded-lg text-orange-400 font-bold border border-orange-500/30">
                ⚠️ Next due date: {formatDate(rentStatus.dueDate)}
              </div>
            </div>
          )}
        </div>

        {/* Roommate Vacate Alert */}
        {roommateVacateAlert && (
          <div className="bg-orange-500/10 border-l-4 border-orange-500 text-orange-400 p-4 mb-6 rounded-lg shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚪</span>
              <div className="font-medium">
                <strong>Vacate Notice:</strong> {roommateVacateAlert.name} will vacate in <strong>{roommateVacateAlert.daysLeft}</strong> days (by {formatDate(roommateVacateAlert.date)}).
              </div>
            </div>
          </div>
        )}

        {/* --- STATS CARDS (PREMIUM GLASS) --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100/50 flex items-center justify-center text-xl text-orange-600">💰</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Monthly Rent</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(tenant?.rent_amount)}</p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100/50 flex items-center justify-center text-xl text-emerald-600">✅</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Total Paid</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(tenant?.total_paid || 0)}</p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-xl text-red-600">⚠️</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Pending Amount</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(tenant?.pending_amount || 0)}</p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100/50 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100/50 flex items-center justify-center text-xl text-purple-600">👥</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Roommates</p>
              <p className="text-xl font-bold text-gray-800">{roommates?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* --- ACTION BUTTONS (GRADIENT & GLASS) --- */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowPaymentModal(true)} disabled={isSubmitting} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-md transition disabled:opacity-50">💳 Pay Rent (UPI)</button>
          <button onClick={() => setShowComplaintModal(true)} disabled={isSubmitting} className="border-2 border-orange-300/50 text-orange-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition disabled:opacity-50">📝 Raise Complaint</button>
          {!pendingRoomChangeRequest ? (
            <button onClick={openRoomChangeModal} disabled={isSubmitting} className="border-2 border-blue-300/50 text-blue-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-50 transition disabled:opacity-50">🔄 Request Room Change</button>
          ) : (
            <button disabled className="border-2 border-gray-300/50 text-gray-500 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold cursor-not-allowed">⏳ Room Change Pending</button>
          )}
          {existingVacateRequest ? (
            <button onClick={cancelVacateRequest} disabled={isSubmitting} className="border-2 border-yellow-500/50 text-yellow-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-yellow-50 transition disabled:opacity-50">❌ Cancel Vacate Request</button>
          ) : (
            <button onClick={() => setShowVacateModal(true)} disabled={isSubmitting} className="border-2 border-red-300/50 text-red-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50">🚪 Request Vacate</button>
          )}
        </div>

        {/* --- TABS (ONYX & GOLD) --- */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
          {['overview', 'roommates', 'notices', 'complaints', 'payments'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#1a1a1a] text-white shadow-sm border-b-2 border-orange-500' : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'}`}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'roommates' && `👥 Roommates (${roommates?.length || 0})`}
              {tab === 'notices' && `📢 Notices (${notices?.length || 0})`}
              {tab === 'complaints' && `🔧 My Complaints (${complaints?.length || 0})`}
              {tab === 'payments' && `💰 Payment History (${paymentHistory?.length || 0})`}
            </button>
          ))}
        </div>

        {/* --- TAB CONTENT --- */}
        {activeTab === 'overview' && (
          <OverviewSection
            tenant={tenant}
            room={room}
            property={property}
            owner={owner}
            pendingRoomChangeRequest={pendingRoomChangeRequest}
          />
        )}
        {activeTab === 'roommates' && <RoommatesSection roommates={roommates} room={room} />}
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

      {/* --- MODALS (LAZY LOADED) --- */}
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

// ---------------- THE EXPORT WITH PROVIDER WRAPPER ----------------
export default function TenantDashboard() {
  return (
    <TenantProvider>
      <TenantDashboardContent />
    </TenantProvider>
  )
}
