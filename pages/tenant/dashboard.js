import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { supabase, signOut } from '../../lib/supabase'
import toast from 'react-hot-toast'
import BrandLogo from '../../components/BrandLogo'
import NotificationBell from '../../components/common/NotificationBell'
import ThemeToggle from '../../components/common/ThemeToggle'
import { DashboardSkeleton } from '../../components/ui/Skeleton'

// ---------------- MODULAR IMPORTS ----------------
import { useTenant, TenantProvider } from '../../context/TenantContext'
import { useNotices } from '../../hooks/useNotices'
import { useVacate } from '../../hooks/useVacate'
import { useComplaints } from '../../hooks/useComplaints'
import { usePayments } from '../../hooks/usePayments'
import { useRoomChange } from '../../hooks/useRoomChange'
// ------------------------------------------------

import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils'
import { normalizeBloodGroup } from '../../lib/bloodGroups'

// Content Components (static)
import OverviewSection from '../../components/tenant/OverviewSection'
import DashboardSectionNav from '../../components/dashboard/DashboardSectionNav'
import MobileTopbar from '../../components/dashboard/MobileTopbar'
import MobileBottomNav from '../../components/dashboard/MobileBottomNav'
import DashboardMoreMenu from '../../components/dashboard/DashboardMoreMenu'
import DashboardSidebar from '../../components/dashboard/DashboardSidebar'
import AccountMenu from '../../components/dashboard/AccountMenu'
import { resetDashboardScroll } from '../../lib/dashboardScroll'

const RoommatesSection = dynamic(() => import('../../components/tenant/RoommatesSection'))
const NoticesSection = dynamic(() => import('../../components/tenant/NoticesSection'))
const ComplaintsSection = dynamic(() => import('../../components/tenant/ComplaintsSection'))
const PaymentsSection = dynamic(() => import('../../components/tenant/PaymentsSection'))

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
  const { existingVacateRequest, lastVacateDecision, vacateLoaded, cancelVacateRequest, refreshVacate } = useVacate(tenant, setTenant);
  const { complaints = [], submitComplaint: hookSubmitComplaint, deleteComplaint: hookDeleteComplaint } = useComplaints(tenant);
  
  const { 
    paymentHistory = [], 
    paymentsLoaded,
    paymentLoading, 
    ownerUpiId, 
    ownerUpiPhone, 
    submitPaymentWithProof 
  } = usePayments(tenant, refreshData, owner);

  const {
    pendingRoomChangeRequest,
    lastRoomChangeDecision,
    availableRooms = [],
    showRoomChangeModal,
    setShowRoomChangeModal,
    selectedNewRoom,
    setSelectedNewRoom,
    roomChangeReason,
    setRoomChangeReason,
    openRoomChangeModal,
    submitRoomChangeRequest,
    roomChangeSubmitting
  } = useRoomChange(tenant, refreshData);

  // ----- UI States remaining -----
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showVacateModal, setShowVacateModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title:'', description:'', priority:'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date:'', reason:'', rating:0, review:'' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [mobileMenu, setMobileMenu] = useState(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const sectionRef = useRef(null)
  const openSection = tab => {
    setActiveTab(tab)
    setMobileMenu(null); setProfileMenuOpen(false); resetDashboardScroll()
  }
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name:'', phone:'', email:'', blood_group:'' })
  const [ratingHover, setRatingHover] = useState(0)
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [paymentTransactionId, setPaymentTransactionId] = useState('')
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState('')

  useEffect(() => {
    const tab = typeof router.query.tab === 'string' ? router.query.tab : ''
    if (['overview', 'roommates', 'notices', 'complaints', 'payments'].includes(tab)) setActiveTab(tab)
  }, [router.query.tab])

  // ----- Helper Functions -----
  const copyPaymentDetail = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied!`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}. Please copy it manually.`)
    }
  }
  const copyUpiId = (upiId) => copyPaymentDetail(upiId, 'UPI ID')
  const copyUpiPhone = (phone) => copyPaymentDetail(phone, 'UPI phone number')

  const submitRentPaymentProof = async () => {
    const submitted = await submitPaymentWithProof(paymentScreenshot, paymentTransactionId)
    if (submitted) {
      setPaymentScreenshot(null)
      setPaymentTransactionId('')
      setShowPaymentModal(false)
    }
  }

  // ----- Profile -----
  const openProfile = () => {
    setProfileForm({ name: tenant?.name || '', phone: tenant?.phone || '', email: tenant?.email || '', blood_group: tenant?.blood_group || '' })
    setEditProfile(false)
    setShowProfileModal(true)
  }

  const updateProfile = async () => {
    if (isSubmitting) return
    if (!profileForm.name) { toast.error('Name is required'); return }
    if (!normalizeBloodGroup(profileForm.blood_group)) { toast.error('Blood group is required'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('update_tenant_profile', { p_name:profileForm.name, p_phone:profileForm.phone, p_blood_group:normalizeBloodGroup(profileForm.blood_group) })
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
    if (vacateBlockedReason) { toast.error(vacateBlockedReason); return }
    if (!vacateForm.expected_date) { toast.error('Please select expected check-out date'); return }
    if (vacateForm.rating === 0) { toast.error('Please rate your experience (1-5 stars)'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.rpc('request_tenant_vacate', {
        p_expected_check_out: vacateForm.expected_date,
        p_reason: vacateForm.reason || null,
        p_rating: vacateForm.rating,
        p_review: vacateForm.review || null
      })
      if (error) throw new Error(error.message)
      toast.success('Vacate request submitted! Owner will review it.')
      await refreshVacate()
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
  const hasPaymentAwaitingApproval = paymentHistory.some((payment) => payment.status === 'payment_pending')
  const hasOutstandingRent = Number(tenant?.pending_amount || 0) > 0 || tenant?.rent_status !== 'paid' || rentStatus.status !== 'paid'
  const vacateBlockedReason = !vacateLoaded || !paymentsLoaded
    ? 'Checking vacate eligibility...'
    : existingVacateRequest
      ? 'You already have an active vacate request.'
      : hasPaymentAwaitingApproval
        ? 'Your latest payment is awaiting owner verification.'
        : hasOutstandingRent
          ? 'Outstanding rent must be cleared before requesting vacate.'
          : null

  const handleLogout = async () => {
    await signOut();
    window.location.replace('/login');
  }

  if (loading || !tenant) {
    return <DashboardSkeleton cards={6} />
  }

  const tenantViewTitle = ({ overview: 'Dashboard', roommates: 'Roommates', notices: 'Notices', complaints: 'Complaints', payments: 'Payments', 'room-change': 'Room change', vacate: 'Vacate request' })[activeTab] || 'Dashboard'
  const tenantBottomItems = [
    { id: 'overview', label: 'Home', icon: '⌂' }, { id: 'payments', label: 'Payments', icon: '₹' }, { id: 'notices', label: 'Notices', icon: '●' },
    { id: 'requests', label: 'Requests', icon: '↗' }, { id: 'more', label: 'More', icon: '•••' },
  ]
  const tenantBottomIcons = { overview:'home', payments:'payments', notices:'notices', requests:'requests', more:'more' }; tenantBottomItems.forEach(item => { item.icon = tenantBottomIcons[item.id] })
  const tenantSidebarItems = [{id:'overview',label:'Dashboard',icon:'dashboard'},{id:'payments',label:'Payments',icon:'payments'},{id:'notices',label:'Notices',icon:'notices'},{id:'complaints',label:'Complaints',icon:'complaints'},{id:'room-change',label:'Requests',icon:'requests'},{id:'roommates',label:'Roommates',icon:'users'}]

  return (
    <div className="dashboard-shell min-h-screen max-w-full overflow-x-hidden bg-[#f8f9fa] pb-24 font-sans lg:pb-0">
      <MobileTopbar title={tenantViewTitle} subtitle={activeTab === 'overview' ? property?.name : `Room ${room?.room_number || '—'}`} isHome={activeTab === 'overview'} onBack={() => openSection('overview')} onProfile={() => setProfileMenuOpen(value=>!value)} avatar={tenant?.name?.charAt(0) || 'U'} controls={<><ThemeToggle compact /><NotificationBell listenForGlobalOpen /></>} accountMenu={<AccountMenu open={profileMenuOpen} onClose={()=>setProfileMenuOpen(false)} name={tenant?.name||'Tenant'} subtitle={property?.name} avatar={tenant?.name?.charAt(0)||'U'} actions={[{label:'My profile',onClick:openProfile},{label:'Logout',onClick:handleLogout,danger:true}]}/>} />
      <DashboardSidebar role="Tenant" items={tenantSidebarItems} activeId={activeTab} onSelect={openSection} footer={<div><p className="truncate text-sm font-bold text-white">{property?.name}</p><p className="mt-1 text-xs text-slate-400">Room {room?.room_number || '—'}</p></div>}/>
      
      {/* --- NAVBAR (Premium Onyx & Gold) --- */}
      <nav className="dashboard-desktop-header">
        <div className="container mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo priority />
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className={`hidden sm:inline-flex items-center gap-2 text-xs font-semibold ${realtimeConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
            <button onPointerEnter={() => ProfileModal.preload?.()} onFocus={() => ProfileModal.preload?.()} onClick={openProfile} aria-label="Open my profile" className="flex items-center gap-2 text-gray-400 hover:text-orange-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {tenant?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm hidden md:inline font-medium text-orange-300/80">{tenant?.name}</span>
            </button>
            <ThemeToggle compact />
            <NotificationBell />
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main container mx-auto min-w-0 px-3 py-5 sm:px-4 sm:py-8">
        
        {/* --- WELCOME SECTION (GLASSMORPHISM) --- */}
        {activeTab === 'overview' && <div className="relative overflow-hidden rounded-2xl p-4 sm:p-8 mb-5 sm:mb-8 bg-[#1a1a1a] shadow-xl border border-orange-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />
          <div className="flex justify-between items-start flex-wrap gap-4 relative z-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome back, <span className="text-orange-400">{tenant?.name}</span>! 👋</h2>
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
        </div>}

        {/* Roommate Vacate Alert */}
        {activeTab === 'overview' && roommateVacateAlert && (
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
        {activeTab === 'overview' && <section aria-labelledby="tenant-summary-title" className="mb-6 sm:mb-8"><div className="mb-3"><h2 id="tenant-summary-title" className="text-lg font-bold text-slate-900">Account summary</h2><p className="text-sm text-slate-500">Rent, requests, and activity at a glance.</p></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <button type="button" onClick={() => openSection('payments')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-orange-100/50 flex items-center justify-center text-base sm:text-xl text-orange-600">💰</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Monthly Rent</p>
              <p className="text-base sm:text-xl font-bold text-gray-800 truncate">{formatCurrency(tenant?.rent_amount)}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('payments')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-emerald-100/50 flex items-center justify-center text-base sm:text-xl text-emerald-600">✅</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Total Paid</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600 truncate">{formatCurrency(tenant?.total_paid || 0)}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('payments')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-red-100/50 flex items-center justify-center text-base sm:text-xl text-red-600">⚠️</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Pending Amount</p>
              <p className="text-base sm:text-xl font-bold text-red-500 truncate">{formatCurrency(tenant?.pending_amount || 0)}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('payments')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-slate-100/50 flex items-center justify-center text-base sm:text-xl text-slate-600">₹</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Deposit</p>
              <p className="text-base sm:text-xl font-bold text-gray-800 truncate">{formatCurrency(tenant?.security_deposit_amount || 0)}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('roommates')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-purple-100/50 flex items-center justify-center text-base sm:text-xl text-purple-600">👥</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Roommates</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{roommates?.length || 0}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('notices')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-cyan-100/50 flex items-center justify-center text-xs sm:text-sm font-bold text-cyan-700">Note</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Notices</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{notices?.length || 0}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('complaints')} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-rose-100/50 flex items-center justify-center text-xs sm:text-sm font-bold text-rose-700">Fix</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Complaints</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{complaints?.length || 0}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('room-change')} disabled={isSubmitting} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-70">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-blue-100/50 flex items-center justify-center text-xs sm:text-sm font-bold text-blue-700">Move</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Room Change</p>
              <p className="text-base sm:text-xl font-bold text-gray-800">{pendingRoomChangeRequest ? 'Pending' : 'Request'}</p>
            </div>
          </button>
          <button type="button" onClick={() => openSection('vacate')} disabled={isSubmitting} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition flex items-center gap-2 sm:gap-3 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-70">
            <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full bg-yellow-100/50 flex items-center justify-center text-xs sm:text-sm font-bold text-yellow-700">Out</div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Vacate</p>
              <p className="text-base sm:text-xl font-bold text-gray-800 capitalize">{existingVacateRequest ? existingVacateRequest.status : 'Request'}</p>
            </div>
          </button>
        </div></section>}

        {/* --- ACTION BUTTONS (GRADIENT & GLASS) --- */}
        {activeTab === 'overview' && <section aria-labelledby="tenant-actions-title" className="mb-6 sm:mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><h2 id="tenant-actions-title" className="font-bold text-slate-900">Quick actions</h2><p className="text-sm text-slate-500">Pay rent or send a request to your property team.</p></div><div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-3">
          <button onPointerEnter={() => PayRentModal.preload?.()} onFocus={() => PayRentModal.preload?.()} onClick={() => setShowPaymentModal(true)} disabled={isSubmitting} className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-md transition disabled:opacity-50">💳 Pay Rent (UPI)</button>
          <button onPointerEnter={() => ComplaintModal.preload?.()} onFocus={() => ComplaintModal.preload?.()} onClick={() => setShowComplaintModal(true)} disabled={isSubmitting} className="w-full sm:w-auto border-2 border-orange-300/50 text-orange-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition disabled:opacity-50">📝 Raise Complaint</button>
          {!pendingRoomChangeRequest ? (
            <button onPointerEnter={() => RoomChangeModal.preload?.()} onFocus={() => RoomChangeModal.preload?.()} onClick={openRoomChangeModal} disabled={isSubmitting} className="w-full sm:w-auto border-2 border-blue-300/50 text-blue-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-50 transition disabled:opacity-50">🔄 Request Room Change</button>
          ) : (
            <button disabled className="w-full sm:w-auto border-2 border-gray-300/50 text-gray-500 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold cursor-not-allowed">⏳ Room Change Pending</button>
          )}
          {existingVacateRequest ? (
            <button onClick={cancelVacateRequest} disabled={isSubmitting} className="w-full sm:w-auto border-2 border-yellow-500/50 text-yellow-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-yellow-50 transition disabled:opacity-50">{existingVacateRequest.status === 'approved' ? '✓ Vacate Approved · Cancel' : '⏳ Vacate Request Pending · Cancel'}</button>
          ) : (
            <button onPointerEnter={() => VacateModal.preload?.()} onFocus={() => VacateModal.preload?.()} onClick={() => setShowVacateModal(true)} disabled={isSubmitting || Boolean(vacateBlockedReason)} title={vacateBlockedReason || undefined} className="w-full sm:w-auto border-2 border-red-300/50 text-red-700 bg-white/50 backdrop-blur-sm px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed">🚪 Request Vacate</button>
          )}
        </div></section>}
        {activeTab === 'overview' && vacateBlockedReason && (
          <p className="-mt-4 mb-6 text-sm font-medium text-red-600" role="status">{vacateBlockedReason}</p>
        )}

        {/* --- TABS (ONYX & GOLD) --- */}
        <div className="hidden"><DashboardSectionNav label="Tenant dashboard sections" activeId={activeTab} onSelect={openSection} items={[
          { id: 'overview', label: 'Overview' }, { id: 'roommates', label: `Roommates (${roommates?.length || 0})` },
          { id: 'notices', label: `Notices (${notices?.length || 0})` }, { id: 'complaints', label: `Complaints (${complaints?.length || 0})` },
          { id: 'payments', label: `Payments (${paymentHistory?.length || 0})` },
        ]} /></div>

        {/* --- TAB CONTENT --- */}
        <div ref={sectionRef} className="scroll-mt-28">
        {activeTab === 'overview' && (
          <OverviewSection
            tenant={tenant}
            room={room}
            property={property}
            owner={owner}
            pendingRoomChangeRequest={pendingRoomChangeRequest}
            lastRoomChangeDecision={lastRoomChangeDecision}
            vacateRequest={existingVacateRequest}
            lastVacateDecision={lastVacateDecision}
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
        {activeTab === 'room-change' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:hidden"><h2 className="text-lg font-bold text-slate-900">Room change</h2><p className="mt-2 text-sm text-slate-600">{pendingRoomChangeRequest ? 'Your room-change request is awaiting approval.' : 'Request a move to another available room.'}</p><button type="button" onClick={openRoomChangeModal} disabled={isSubmitting || Boolean(pendingRoomChangeRequest)} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{pendingRoomChangeRequest ? 'Request pending' : 'Choose a room'}</button></section>}
        {activeTab === 'vacate' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:hidden"><h2 className="text-lg font-bold text-slate-900">Vacate request</h2><p className="mt-2 text-sm text-slate-600">{existingVacateRequest ? `Your request is ${existingVacateRequest.status}.` : (vacateBlockedReason || 'Submit a planned checkout request to your owner.')}</p>{existingVacateRequest ? <button type="button" onClick={cancelVacateRequest} disabled={isSubmitting} className="mt-5 w-full rounded-xl border border-amber-300 px-4 py-3 font-semibold text-amber-700 disabled:opacity-50">Cancel request</button> : <button type="button" onClick={() => setShowVacateModal(true)} disabled={isSubmitting || Boolean(vacateBlockedReason)} className="mt-5 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50">Request vacate</button>}</section>}
        </div>
      </main>

      <MobileBottomNav items={tenantBottomItems} activeId={['requests', 'more'].includes(mobileMenu) ? mobileMenu : activeTab} onSelect={id => { if (id === 'requests' || id === 'more') setMobileMenu(id); else { setMobileMenu(null); openSection(id) } }} />
      <DashboardMoreMenu open={mobileMenu === 'requests'} title="Requests" subtitle={property?.name} onClose={() => setMobileMenu(null)} items={[
        { id: 'complaints', group: 'Requests', label: 'My complaints', onClick: () => openSection('complaints') },
        { id: 'raise', group: 'Requests', label: 'Raise complaint', onClick: () => setShowComplaintModal(true) },
        { id: 'room-change', group: 'Requests', label: pendingRoomChangeRequest ? 'Room change pending' : 'Request room change', onClick: () => openSection('room-change') },
        { id: 'vacate', group: 'Requests', label: existingVacateRequest ? 'View vacate status' : 'Request vacate', onClick: () => openSection('vacate') },
      ]} />
      <DashboardMoreMenu open={mobileMenu === 'more'} title="Tenant menu" subtitle={property?.name} onClose={() => setMobileMenu(null)} items={[
        { id: 'home', group: 'Main', label: 'Home', onClick: () => openSection('overview') },
        { id: 'payments', group: 'Main', label: 'Payments', onClick: () => openSection('payments') },
        { id: 'notices', group: 'Main', label: 'Notices', onClick: () => openSection('notices') },
        { id: 'notifications', group: 'Main', label: 'Notifications', onClick: () => window.dispatchEvent(new Event('hostelset:open-notifications')) },
        { id: 'complaints', group: 'Requests', label: 'Complaints', onClick: () => openSection('complaints') },
        { id: 'room-change', group: 'Requests', label: 'Room change', onClick: () => openSection('room-change') },
        { id: 'vacate', group: 'Requests', label: 'Vacate', onClick: () => openSection('vacate') },
        { id: 'profile', group: 'Account', label: 'My profile', onClick: openProfile },
        { id: 'roommates', group: 'Account', label: 'Roommates', onClick: () => openSection('roommates') },
        { id: 'logout', group: 'Account', label: 'Logout', danger: true, onClick: handleLogout },
      ]} />

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
            copyUpiId={copyUpiId}
            copyUpiPhone={copyUpiPhone}
            submitPaymentWithProof={submitRentPaymentProof}
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
            isSubmitting={isSubmitting || roomChangeSubmitting}
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
