import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';

// Modular Imports
import { useOwner, OwnerProvider } from '../../context/OwnerContext';
import { useOwnerRooms } from '../../hooks/useOwnerRooms';
import { useOwnerTenants } from '../../hooks/useOwnerTenants';
import { useOwnerComplaints } from '../../hooks/useOwnerComplaints';
import { useOwnerVacate } from '../../hooks/useOwnerVacate';
import { useOwnerPayments } from '../../hooks/useOwnerPayments';
import { useOwnerNotices } from '../../hooks/useOwnerNotices';
import { useOwnerRoomChange } from '../../hooks/useOwnerRoomChange';
import { useOwnerApplications } from '../../hooks/useOwnerApplications';
import { useOwnerPreBookings } from '../../hooks/useOwnerPreBookings';

// Content Components
import StatsCards from '../../components/owner/StatsCards';
import RoomList from '../../components/owner/RoomList';
import TenantTable from '../../components/owner/TenantTable';
import RentPaymentsList from '../../components/owner/RentPaymentsList';
import PaymentHistoryTable from '../../components/owner/PaymentHistoryTable';
import PreBookingList from '../../components/owner/PreBookingList';
import ApplicationList from '../../components/owner/ApplicationList';
import ComplaintList from '../../components/owner/ComplaintList';
import VacateRequestList from '../../components/owner/VacateRequestList';
import NoticeList from '../../components/owner/NoticeList';
import RoomChangeRequestList from '../../components/owner/RoomChangeRequestList';

// Modal Components
const ConfirmDeleteModal = dynamic(() => import('../../components/owner/modals/ConfirmDeleteModal'), { ssr: false });
const AddTenantModal = dynamic(() => import('../../components/owner/modals/AddTenantModal'), { ssr: false });
const AddRoomModal = dynamic(() => import('../../components/owner/modals/AddRoomModal'), { ssr: false });
const CollectRentModal = dynamic(() => import('../../components/owner/modals/CollectRentModal'), { ssr: false });
const PostNoticeModal = dynamic(() => import('../../components/owner/modals/PostNoticeModal'), { ssr: false });
const SettingsModal = dynamic(() => import('../../components/owner/modals/SettingsModal'), { ssr: false });
const ComplaintResponseModal = dynamic(() => import('../../components/owner/modals/ComplaintResponseModal'), { ssr: false });
const RoomDetailsModal = dynamic(() => import('../../components/owner/modals/RoomDetailsModal'), { ssr: false });
const MembershipModal = dynamic(() => import('../../components/owner/modals/MembershipModal'), { ssr: false });
const PaymentConfirmModal = dynamic(() => import('../../components/owner/modals/PaymentConfirmModal'), { ssr: false });
const ApplicationDetailModal = dynamic(() => import('../../components/owner/modals/ApplicationDetailModal'), { ssr: false });
const TenantPaymentsModal = dynamic(() => import('../../components/owner/modals/TenantPaymentsModal'), { ssr: false });
const TenantProfileModal = dynamic(() => import('../../components/owner/modals/TenantProfileModal'), { ssr: false });
const RoomChangeReasonModal = dynamic(() => import('../../components/owner/modals/RoomChangeReasonModal'), { ssr: false });
const ScreenshotModal = dynamic(() => import('../../components/owner/modals/ScreenshotModal'), { ssr: false });

export default function OwnerDashboard() {
  return (
    <OwnerProvider>
      <OwnerDashboardContent />
    </OwnerProvider>
  );
}

function OwnerDashboardContent() {
  const router = useRouter();
  const core = useOwner();
  const { 
    loading, 
    property, 
    propertyImages, 
    setPropertyImages, 
    rooms, 
    setRooms, 
    tenants, 
    setTenants, 
    settings, 
    setSettings, 
    stats, 
    setStats, 
    roomMonthlyIncome, 
    membershipActive, 
    membershipLoading, 
    membershipStatus, 
    membershipExpiry, 
    daysLeft, 
    loadData, 
    loadSettings, 
    saveSettings, 
    initiateMembershipPayment, 
    startAutoRefresh 
  } = core;
  
  const { showRoomModal, setShowRoomModal, roomForm, setRoomForm, sharingTypes, addRoom, deleteRoom } = useOwnerRooms(property, rooms, setRooms, setStats);
  const { formData, setFormData, addTenant } = useOwnerTenants(property, rooms, tenants, setTenants, setStats, loadData);
  const { complaints, respondToComplaint, resolveComplaint } = useOwnerComplaints(property);
  const { vacateRequests, approveVacateRequest } = useOwnerVacate(property);
  const { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment } = useOwnerPayments(property, tenants, setStats, loadData);
  const { notices, postNotice, deleteNotice } = useOwnerNotices(property);
  const { roomChangeRequests, approveRoomChange, rejectRoomChange } = useOwnerRoomChange(property);
  const { applications, approveApplication, rejectApplication, resendPasswordEmail } = useOwnerApplications(property);
  const { preBookings, approvePreBooking, rejectPreBooking } = useOwnerPreBookings(property);

  // Local UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showComplaintResponseModal, setShowComplaintResponseModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [showApplicationDetailModal, setShowApplicationDetailModal] = useState(false);
  const [showTenantPaymentsModal, setShowTenantPaymentsModal] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [showTenantProfileModal, setShowTenantProfileModal] = useState(false);
  const [showRoomChangeReasonModal, setShowRoomChangeReasonModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedTenantForPayments, setSelectedTenantForPayments] = useState(null);
  const [selectedProfileTenant, setSelectedProfileTenant] = useState(null);
  const [selectedRoomChangeRequest, setSelectedRoomChangeRequest] = useState(null);
  const [confirmingTenant, setConfirmingTenant] = useState(null);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [complaintResponse, setComplaintResponse] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [tenantPayments, setTenantPayments] = useState([]);
  const [tenantApplication, setTenantApplication] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });

  const getRoomNumberById = (roomId) => { const room = rooms.find(r => r.id === roomId); return room ? room.room_number : 'N/A' }
  const getTenantsInRoom = (roomId) => tenants.filter(t => t.room_id === roomId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-orange-400">Loading your golden suite...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="bg-[#1a1a1a] border-b border-orange-500/30 px-6 py-4 flex justify-between items-center text-white">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
          <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-400 hover:text-red-300 transition">Logout</button>
        </nav>
        <div className="text-center py-20">
          <div className="text-6xl mb-6">🏠</div>
          <h1 className="text-2xl font-bold mb-4 text-[#1a1a1a]">Welcome to HOSTELSET!</h1>
          <Link href="/owner/register-property" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-full font-semibold transition shadow-lg">
            Register Your First Property →
          </Link>
        </div>
      </div>
    )
  }

  const safeRooms = Array.isArray(rooms) ? rooms : []
  const safeTenants = Array.isArray(tenants) ? tenants : []
  const safeAllPayments = Array.isArray(allPayments) ? allPayments : []
  const safeComplaints = Array.isArray(complaints) ? complaints : []
  const safeVacateRequests = Array.isArray(vacateRequests) ? vacateRequests : []
  const safeNotices = Array.isArray(notices) ? notices : []
  const safeRoomChangeRequests = Array.isArray(roomChangeRequests) ? roomChangeRequests : []
  const safeApplications = Array.isArray(applications) ? applications : []
  const safePreBookings = Array.isArray(preBookings) ? preBookings : []

  const searchLower = searchTerm.trim().toLowerCase()

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans">
      
      {/* --- NAVBAR (Premium Onyx & Gold) --- */}
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-6 py-4 shadow-lg border-b-2 border-orange-500/80">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input type="text" placeholder="🔍 Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-[#2a2a2a] border border-gray-700/50 rounded-lg px-4 py-2 text-sm w-48 md:w-64 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
            <button onClick={() => setShowMembershipModal(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm ${membershipActive ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
              {membershipActive ? '✅ Active' : '⭐ Subscribe'}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="text-gray-400 hover:text-orange-400 transition px-3 py-1.5 rounded-lg hover:bg-white/5">⚙️</button>
            <span className="text-sm hidden md:inline text-orange-300/80">{property.name}</span>
            <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-400 hover:text-red-300 transition font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        
        {/* --- STATS CARDS --- */}
        <StatsCards stats={stats} />

        {/* --- ACTION BUTTONS (Glassmorphism) --- */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button onClick={() => membershipActive && setShowAddModal(true)} disabled={!membershipActive} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-md ${membershipActive ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>+ Add Tenant</button>
          <button onClick={() => membershipActive && setShowRoomModal(true)} disabled={!membershipActive} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Add Room</button>
          <button onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>📢 Notice</button>
        </div>

        {/* --- TABS --- */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
          {['overview', 'rooms', 'tenants', 'rent-payments', 'payment-history', 'pre-bookings', 'applications', 'complaints', 'vacate', 'room-change', 'notices'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} disabled={!membershipActive} className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#1a1a1a] text-white shadow-sm border-b-2 border-orange-500' : membershipActive ? 'text-gray-600 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 cursor-not-allowed'}`}>
              {tab === 'rent-payments' && `💸 Rent (${stats.pendingRentConfirmations})`}
              {tab === 'payment-history' && '💳 History'}
              {tab === 'pre-bookings' && `📋 Pre-Bookings`}
              {tab === 'applications' && `📝 Applications`}
              {tab === 'overview' && '📊 Overview'}
              {tab === 'rooms' && `🏠 Rooms (${rooms.length})`}
              {tab === 'tenants' && `👥 Tenants (${tenants.length})`}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints > 0 ? `(${stats.totalComplaints})` : ''}`}
              {tab === 'vacate' && `🚪 Vacate ${stats.pendingVacate > 0 ? `(${stats.pendingVacate})` : ''}`}
              {tab === 'room-change' && `🔄 Change (${roomChangeRequests.length})`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
            </button>
          ))}
        </div>

        {/* --- TAB CONTENT --- */}
        {activeTab === 'rooms' && <RoomList rooms={safeRooms} tenants={safeTenants} vacateRequests={safeVacateRequests} roomMonthlyIncome={roomMonthlyIncome} onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} onDeleteRoom={(id) => deleteRoom(id, isSubmitting, setIsSubmitting)} isSubmitting={isSubmitting} />}
        {activeTab === 'tenants' && <TenantTable tenants={safeTenants} vacateRequests={safeVacateRequests} onCollect={(tenant) => { setSelectedTenant(tenant); setShowPaymentModal(true) }} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={(tenant) => { setConfirmingTenant(tenant); setShowPaymentConfirmModal(true) }} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'rent-payments' && <RentPaymentsList payments={safeAllPayments} onConfirm={confirmRentPayment} onReject={rejectRentPayment} onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'payment-history' && <PaymentHistoryTable payments={safeAllPayments} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'pre-bookings' && <PreBookingList bookings={safePreBookings} onApprove={(id, data) => approvePreBooking(id, data)} onReject={rejectPreBooking} onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'applications' && <ApplicationList applications={safeApplications} onApprove={(id, data) => approveApplication(id, data)} onResendEmail={resendPasswordEmail} isSubmitting={isSubmitting} />}
        {activeTab === 'complaints' && <ComplaintList complaints={safeComplaints} onRespond={(complaint) => { setSelectedComplaint(complaint); setShowComplaintResponseModal(true) }} onResolve={resolveComplaint} isSubmitting={isSubmitting} />}
        {activeTab === 'vacate' && <VacateRequestList requests={safeVacateRequests} onApprove={approveVacateRequest} isSubmitting={isSubmitting} />}
        {activeTab === 'room-change' && <RoomChangeRequestList requests={safeRoomChangeRequests} onApprove={approveRoomChange} onReject={(request) => { setSelectedRoomChangeRequest(request); setRejectionReason(''); setShowRoomChangeReasonModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'notices' && <NoticeList notices={safeNotices} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />}
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showSettingsModal && <SettingsModal settings={settings} setSettings={setSettings} onSave={() => saveSettings(settings)} onCancel={() => setShowSettingsModal(false)} isSubmitting={isSubmitting} />}
        {showAddModal && <AddTenantModal formData={formData} setFormData={setFormData} rooms={rooms} onAdd={() => addTenant(isSubmitting, setIsSubmitting)} onCancel={() => setShowAddModal(false)} isSubmitting={isSubmitting} />}
        {showRoomModal && <AddRoomModal roomForm={roomForm} setRoomForm={setRoomForm} sharingTypes={sharingTypes} onAdd={() => addRoom(isSubmitting, setIsSubmitting)} onCancel={() => setShowRoomModal(false)} isSubmitting={isSubmitting} />}
        {showNoticeModal && <PostNoticeModal noticeForm={noticeForm} setNoticeForm={setNoticeForm} onPost={() => postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent)} onCancel={() => setShowNoticeModal(false)} isSubmitting={isSubmitting} />}
        {showMembershipModal && <MembershipModal onSelectPlan={initiateMembershipPayment} onCancel={() => setShowMembershipModal(false)} loading={membershipLoading} />}
        {showComplaintResponseModal && selectedComplaint && <ComplaintResponseModal complaint={selectedComplaint} response={complaintResponse} setResponse={setComplaintResponse} onSend={() => respondToComplaint(selectedComplaint.id, complaintResponse)} onCancel={() => setShowComplaintResponseModal(false)} isSubmitting={isSubmitting} />}
        {showRoomDetailsModal && selectedRoom && <RoomDetailsModal room={selectedRoom} tenantsInRoom={getTenantsInRoom(selectedRoom.id)} onClose={() => setShowRoomDetailsModal(false)} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
      </AnimatePresence>
    </div>
  )
}