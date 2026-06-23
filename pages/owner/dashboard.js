import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary'; // 

// Modular Imports
import { useOwner, OwnerProvider } from '../../context/OwnerContext';
import { useOwnerRooms } from '../../hooks/useOwnerRooms';
import { useOwnerTenants } from '../../hooks/useOwnerTenants';
import { useOwnerComplaints } from '../../hooks/useOwnerComplaints';
import { useOwnerVacate } from '../../hooks/useOwnerVacate';
import { useOwnerPayments } from '../../hooks/useOwnerPayments';
import { useOwnerNotices } from '../../hooks/useOwnerNotices';
import { useOwnerRoomChange } from '../../hooks/useOwnerRoomChange';

// Content Components
import StatsCards from '../../components/owner/StatsCards';
import RoomList from '../../components/owner/RoomList';
import TenantTable from '../../components/owner/TenantTable';
import RentPaymentsList from '../../components/owner/RentPaymentsList';
import PaymentHistoryTable from '../../components/owner/PaymentHistoryTable';
import PreBookingList from '../../components/owner/PreBookingList';
import ComplaintList from '../../components/owner/ComplaintList';
import VacateRequestList from '../../components/owner/VacateRequestList';
import NoticeList from '../../components/owner/NoticeList';
import ApplicationList from '../../components/owner/ApplicationList';
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
    <ErrorBoundary> {/* <-- Wrap everything in here */}
      <OwnerProvider>
        <OwnerDashboardContent />
      </OwnerProvider>
    </ErrorBoundary>
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
          <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-500">Logout</button>
        </nav>
        <div className="text-center py-20">
          <div className="text-6xl mb-6">🏠</div>
          <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
          <Link href="/owner/register-property" className="bg-slate-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-slate-700 transition">
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

  const searchLower = searchTerm.trim().toLowerCase()

  return (
    <div className="min-h-screen bg-white">
      {!membershipActive && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3 text-center sticky top-0 z-50">
          <p className="text-yellow-800 font-semibold">⭐ You're exploring the dashboard with limited access. <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline text-yellow-900 font-bold hover:text-yellow-950">Subscribe now</button> to unlock all features.</p>
        </div>
      )}

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input type="text" placeholder="🔍 Search by name, room, phone, title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-500" />
            <button onClick={() => setShowMembershipModal(true)} className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${membershipActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{membershipActive ? '✅ Active' : '⭐ Buy Membership'}</button>
            <button onClick={() => setShowSettingsModal(true)} className="text-gray-500 hover:text-slate-800 transition px-3 py-1 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
            <span className="text-sm hidden md:inline text-gray-500">{property.name}</span>
            <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <StatsCards stats={stats} />
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => membershipActive && setShowAddModal(true)} disabled={!membershipActive} className={`px-5 py-2 rounded-full text-sm font-semibold transition ${membershipActive ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>+ Add Tenant</button>
          <button onClick={() => membershipActive && setShowRoomModal(true)} disabled={!membershipActive} className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${membershipActive ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Add Room</button>
          <button onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive} className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${membershipActive ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>📢 Post Notice</button>
          <button onClick={() => membershipActive && setShowSettingsModal(true)} disabled={!membershipActive} className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${membershipActive ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>⚙️ Settings</button>
        </div>

        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'rooms', 'tenants', 'rent-payments', 'payment-history', 'complaints', 'vacate', 'room-change', 'notices'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} disabled={!membershipActive} className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : membershipActive ? 'text-gray-500 hover:text-slate-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}>
              {tab === 'rent-payments' && `💸 Rent Payments (${stats.pendingRentConfirmations})`}
              {tab === 'payment-history' && '💳 Payment History'}
              {tab === 'overview' && '📊 Overview'}
              {tab === 'rooms' && `🏠 Rooms (${rooms.length})`}
              {tab === 'tenants' && `👥 Tenants (${tenants.length})`}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints > 0 ? `(${stats.totalComplaints})` : ''}`}
              {tab === 'vacate' && `🚪 Vacate ${stats.pendingVacate > 0 ? `(${stats.pendingVacate})` : ''}`}
              {tab === 'room-change' && `🔄 Room Change (${roomChangeRequests.length})`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'rooms' && <RoomList rooms={safeRooms} tenants={safeTenants} vacateRequests={safeVacateRequests} roomMonthlyIncome={roomMonthlyIncome} onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} onDeleteRoom={(id) => deleteRoom(id, isSubmitting, setIsSubmitting)} isSubmitting={isSubmitting} />}
        {activeTab === 'tenants' && <TenantTable tenants={safeTenants} vacateRequests={safeVacateRequests} onCollect={(tenant) => { setSelectedTenant(tenant); setShowPaymentModal(true) }} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={(tenant) => { setConfirmingTenant(tenant); setShowPaymentConfirmModal(true) }} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'rent-payments' && <RentPaymentsList payments={safeAllPayments} onConfirm={confirmRentPayment} onReject={rejectRentPayment} onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'payment-history' && <PaymentHistoryTable payments={safeAllPayments} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'complaints' && <ComplaintList complaints={safeComplaints} onRespond={(complaint) => { setSelectedComplaint(complaint); setShowComplaintResponseModal(true) }} onResolve={resolveComplaint} isSubmitting={isSubmitting} />}
        {activeTab === 'vacate' && <VacateRequestList requests={safeVacateRequests} onApprove={approveVacateRequest} isSubmitting={isSubmitting} />}
        {activeTab === 'room-change' && <RoomChangeRequestList requests={safeRoomChangeRequests} onApprove={approveRoomChange} onReject={(request) => { setSelectedRoomChangeRequest(request); setRejectionReason(''); setShowRoomChangeReasonModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'notices' && <NoticeList notices={safeNotices} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />}
      </div>

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
