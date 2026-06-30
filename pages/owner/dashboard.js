import { useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

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

const RoomList = dynamic(() => import('../../components/owner/RoomList'));
const TenantTable = dynamic(() => import('../../components/owner/TenantTable'));
const RentPaymentsList = dynamic(() => import('../../components/owner/RentPaymentsList'));
const PaymentHistoryTable = dynamic(() => import('../../components/owner/PaymentHistoryTable'));
const PreBookingList = dynamic(() => import('../../components/owner/PreBookingList'));
const ApplicationList = dynamic(() => import('../../components/owner/ApplicationList'));
const ComplaintList = dynamic(() => import('../../components/owner/ComplaintList'));
const VacateRequestList = dynamic(() => import('../../components/owner/VacateRequestList'));
const NoticeList = dynamic(() => import('../../components/owner/NoticeList'));
const RoomChangeRequestList = dynamic(() => import('../../components/owner/RoomChangeRequestList'));

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
const OwnerProfileModal = dynamic(() => import('../../components/owner/modals/OwnerProfileModal'), { ssr: false });

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
    realtimeConnected,
    property, 
    ownerProfile,
    updateOwnerProfile,
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
    loadData, 
    saveSettings, 
    pendingMembershipRequest,
    requestMembership
  } = core;
  const [activeTab, setActiveTab] = useState('overview');
  
  const { showRoomModal, setShowRoomModal, roomForm, setRoomForm, sharingTypes, addRoom, deleteRoom } = useOwnerRooms(property, rooms, setRooms, setStats);
  const { formData, setFormData, addTenant } = useOwnerTenants(property, rooms, tenants, setTenants, setStats, loadData);
  const { complaints, respondToComplaint, resolveComplaint } = useOwnerComplaints(property, activeTab === 'complaints');
  const { vacateRequests, approveVacateRequest } = useOwnerVacate(property, activeTab === 'vacate' || activeTab === 'rooms' || activeTab === 'tenants');
  const { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment } = useOwnerPayments(property, tenants, setStats, loadData, activeTab === 'rent-payments' || activeTab === 'payment-history');
  const { notices, postNotice, deleteNotice } = useOwnerNotices(property, activeTab === 'notices');
  const { roomChangeRequests, approveRoomChange, rejectRoomChange } = useOwnerRoomChange(property, activeTab === 'room-change');
  const { applications, rejectApplication, resendPasswordEmail } = useOwnerApplications(property, activeTab === 'applications');
  const { preBookings, approvePreBooking, rejectPreBooking } = useOwnerPreBookings(property, activeTab === 'pre-bookings');

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
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [showOwnerProfileModal, setShowOwnerProfileModal] = useState(false);
  const [showRoomChangeReasonModal, setShowRoomChangeReasonModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedRoomChangeRequest, setSelectedRoomChangeRequest] = useState(null);
  const [confirmingTenant, setConfirmingTenant] = useState(null);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [complaintResponse, setComplaintResponse] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });

  // Modal States for History & Profile
  const [showTenantPaymentsModal, setShowTenantPaymentsModal] = useState(false);
  const [showTenantProfileModal, setShowTenantProfileModal] = useState(false);
  const [selectedTenantForPayments, setSelectedTenantForPayments] = useState(null);
  const [selectedProfileTenant, setSelectedProfileTenant] = useState(null);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [tenantApplication, setTenantApplication] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // ----------------------------------------------------------------
  // FETCH FUNCTIONS FOR HISTORY & PROFILE
  // ----------------------------------------------------------------
  const fetchTenantPayments = async (tenant) => {
    setSelectedTenantForPayments(tenant);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setTenantPayments(data || []);
      setShowTenantPaymentsModal(true);
    } catch (error) {
      toast.error('Failed to load payment history');
    }
  };

  const fetchTenantApplication = async (tenant) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .or(`phone.eq.${tenant.phone},email.eq.${tenant.email}`)
        .eq('property_id', property.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      setTenantApplication(data?.[0] || null);
      setSelectedProfileTenant(tenant);
      setShowTenantProfileModal(true);
    } catch (error) {
      toast.error('Could not fetch documents');
    } finally {
      setLoadingProfile(false);
    }
  };

  // ----------------------------------------------------------------
  // FINAL APPROVAL LOGIC (Duplicate phone Check)
  // ----------------------------------------------------------------
  const handleApproveApplication = async (appId, appData) => {
    if (isSubmitting) return;
    if (!appData) {
      toast.error('Application data is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Applications created after payment already have a payment_pending tenant.
      // Promote that record instead of creating a duplicate and counting the room twice.
      const { data: existingTenant, error: existingTenantError } = await supabase
        .from('tenants')
        .select('id, name, status, room_id, user_id')
        .eq('phone', appData.phone)
        .eq('property_id', appData.property_id)
        .maybeSingle();

      if (existingTenantError) throw existingTenantError;

      const moveInDate = appData.expected_move_in
        ? new Date(appData.expected_move_in).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      let roomOccupancyAlreadyCounted = false;

      if (existingTenant) {
        if (existingTenant.status !== 'payment_pending' || existingTenant.room_id !== appData.room_id) {
          toast.error(`A tenant with this phone number (${appData.phone}) already exists. Duplicate prevented.`);
          return;
        }

        const { error: promoteError } = await supabase
          .from('tenants')
          .update({
            status: 'active',
            user_id: existingTenant.user_id || appData.user_id,
            move_in_date: moveInDate,
          })
          .eq('id', existingTenant.id);

        if (promoteError) throw promoteError;
        roomOccupancyAlreadyCounted = false;
      } else {
        let userId = appData.user_id;
        if (!userId) {
          const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .or(`phone.eq.${appData.phone},email.eq.${appData.email}`)
            .maybeSingle();
          if (userError) throw userError;
          userId = existingUser?.id;
        }

        if (!userId) {
          toast.error('Applicant account not found. Ask the applicant to submit again.');
          return;
        }

        const { error: tenantError } = await supabase
          .from('tenants')
          .insert({
            user_id: userId,
            property_id: appData.property_id,
            room_id: appData.room_id,
            name: appData.name,
            phone: appData.phone,
            email: appData.email,
            rent_amount: appData.rooms?.monthly_rent || 0,
            pending_amount: appData.rooms?.monthly_rent || 0,
            total_paid: 0,
            rent_status: 'pending',
            move_in_date: moveInDate,
            status: 'active'
          });

        if (tenantError) throw tenantError;
      }

      if (!roomOccupancyAlreadyCounted) {
        const { data: roomData, error: roomFetchError } = await supabase
          .from('rooms')
          .select('current_occupants, capacity')
          .eq('id', appData.room_id)
          .single();
        if (roomFetchError) throw roomFetchError;
        if ((roomData.current_occupants || 0) >= roomData.capacity) throw new Error('The selected room is already full.');

        const newOccupants = (roomData.current_occupants || 0) + 1;
        const { error: roomError } = await supabase
          .from('rooms')
          .update({ current_occupants: newOccupants, status: newOccupants >= roomData.capacity ? 'occupied' : 'vacant' })
          .eq('id', appData.room_id);
        if (roomError) throw roomError;
      }

      // ---------------------------------------------------------
      // 3. Mark Application as Approved
      // ---------------------------------------------------------
      const { error: appError } = await supabase
        .from('applications')
        .update({ status: 'approved', processed_at: new Date().toISOString() })
        .eq('id', appId);

      if (appError) throw appError;

      // ---------------------------------------------------------
      // 4. Send Password Reset Email
      // ---------------------------------------------------------
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        appData.email,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) {
        toast.warning("Tenant created, but password reset email could not be sent.");
      } else {
        toast.success("📧 Password reset email sent to the tenant!");
      }

      toast.success(`✅ ${appData.name} approved! Tenant created.`);
      await loadData(true); // Refresh the dashboard

    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoomNumberById = (roomId) => { const room = rooms.find(r => r.id === roomId); return room ? room.room_number : 'N/A' }
  const getTenantsInRoom = (roomId) => tenants.filter(t => t.room_id === roomId)

  const handleSaveSettings = async (location) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveSettings(settings);
      if (location?.latitude && property?.id) {
        const { error } = await supabase.from('properties').update({
          latitude: location.latitude,
          longitude: location.longitude,
          formatted_address: location.formatted_address || property.address,
          location_place_id: location.location_place_id || null,
          location_verified: false,
        }).eq('id', property.id).eq('owner_id', property.owner_id);
        if (error) throw error;
      }
      toast.success('Settings saved');
      setShowSettingsModal(false);
    } catch (error) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveOwnerProfile = async (profileData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateOwnerProfile(profileData);
      toast.success('Owner profile updated');
      setShowOwnerProfileModal(false);
    } catch (error) {
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToComplaint = async () => {
    if (isSubmitting || !selectedComplaint) return;
    setIsSubmitting(true);
    try {
      const success = await respondToComplaint(selectedComplaint.id, complaintResponse);
      if (success) {
        setShowComplaintResponseModal(false);
        setSelectedComplaint(null);
        setComplaintResponse('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectRoomChange = async () => {
    if (isSubmitting || !selectedRoomChangeRequest) return;
    setIsSubmitting(true);
    try {
      const success = await rejectRoomChange(selectedRoomChangeRequest.id, rejectionReason);
      if (success) {
        setShowRoomChangeReasonModal(false);
        setSelectedRoomChangeRequest(null);
        setRejectionReason('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
  const safePendingRentPayments = Array.isArray(pendingRentPayments) ? pendingRentPayments : []
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
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-3 sm:px-6 py-3 sm:py-4 shadow-lg border-b-2 border-orange-500/80">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent whitespace-nowrap">🏠 HOSTELSET</h1>
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-4 flex-wrap flex-1 min-w-0">
            <span className={`hidden sm:inline-flex items-center gap-2 text-xs font-semibold ${realtimeConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
            <input type="search" aria-label="Search dashboard" placeholder="🔍 Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-[#2a2a2a] border border-gray-700/50 rounded-lg px-3 sm:px-4 py-2 text-sm w-full sm:w-48 md:w-64 order-last lg:order-none text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
            <button onClick={() => setShowMembershipModal(true)} disabled={Boolean(pendingMembershipRequest)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm ${membershipActive ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : pendingMembershipRequest ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-wait' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
              {membershipActive ? '✅ Active' : pendingMembershipRequest ? '⏳ Approval Pending' : '⭐ Request Membership'}
            </button>
            <button onClick={() => setShowOwnerProfileModal(true)} className="text-gray-400 hover:text-orange-400 transition px-3 py-1.5 rounded-lg hover:bg-white/5" aria-label="Edit owner profile">👤</button>
            <button onClick={() => setShowSettingsModal(true)} className="text-gray-400 hover:text-orange-400 transition px-3 py-1.5 rounded-lg hover:bg-white/5">⚙️</button>
            <span className="text-sm hidden md:inline text-orange-300/80">{property.name}</span>
            <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-400 hover:text-red-300 transition font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">
        
        {/* --- STATS CARDS --- */}
        <StatsCards stats={stats} />

        {/* --- ACTION BUTTONS (Glassmorphism) --- */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button onClick={() => membershipActive && setShowAddModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-md ${membershipActive ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>+ Add Tenant</button>
          <button onClick={() => membershipActive && setShowRoomModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Add Room</button>
          <button onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>📢 Notice</button>
        </div>

        {/* --- TABS --- */}
        <div className="flex flex-nowrap gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto dashboard-tabs">
          {['overview', 'rooms', 'tenants', 'rent-payments', 'payment-history', 'pre-bookings', 'applications', 'complaints', 'vacate', 'room-change', 'notices'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} disabled={!membershipActive} className={`shrink-0 px-4 sm:px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#1a1a1a] text-white shadow-sm border-b-2 border-orange-500' : membershipActive ? 'text-gray-600 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 cursor-not-allowed'}`}>
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
        {activeTab === 'tenants' && <TenantTable tenants={safeTenants} vacateRequests={safeVacateRequests} onCollect={(tenant) => { setSelectedTenant(tenant); setShowPaymentModal(true) }} onHistory={fetchTenantPayments} onProfile={fetchTenantApplication} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={(tenant) => { setConfirmingTenant(tenant); setShowPaymentConfirmModal(true) }} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'rent-payments' && <RentPaymentsList payments={safePendingRentPayments} onConfirm={confirmRentPayment} onReject={rejectRentPayment} onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'payment-history' && <PaymentHistoryTable payments={safeAllPayments} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'pre-bookings' && <PreBookingList bookings={safePreBookings} onApprove={(id, data) => approvePreBooking(id, data)} onReject={rejectPreBooking} onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'applications' && <ApplicationList applications={safeApplications} onApprove={(id, data) => handleApproveApplication(id, data)} onReject={rejectApplication} onResendEmail={resendPasswordEmail} isSubmitting={isSubmitting} />}
        {activeTab === 'complaints' && <ComplaintList complaints={safeComplaints} onRespond={(complaint) => { setSelectedComplaint(complaint); setComplaintResponse(''); setShowComplaintResponseModal(true) }} onResolve={resolveComplaint} isSubmitting={isSubmitting} />}
        {activeTab === 'vacate' && <VacateRequestList requests={safeVacateRequests} onApprove={approveVacateRequest} isSubmitting={isSubmitting} />}
        {activeTab === 'room-change' && <RoomChangeRequestList requests={safeRoomChangeRequests} onApprove={approveRoomChange} onReject={(request) => { setSelectedRoomChangeRequest(request); setRejectionReason(''); setShowRoomChangeReasonModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'notices' && <NoticeList notices={safeNotices} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />}
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showSettingsModal && <SettingsModal settings={settings} setSettings={setSettings} property={property} onSave={handleSaveSettings} onCancel={() => setShowSettingsModal(false)} isSubmitting={isSubmitting} />}
        {showAddModal && <AddTenantModal formData={formData} setFormData={setFormData} rooms={rooms} onAdd={() => addTenant(isSubmitting, setIsSubmitting)} onCancel={() => setShowAddModal(false)} isSubmitting={isSubmitting} />}
        {showRoomModal && <AddRoomModal roomForm={roomForm} setRoomForm={setRoomForm} sharingTypes={sharingTypes} onAdd={() => addRoom(isSubmitting, setIsSubmitting)} onCancel={() => setShowRoomModal(false)} isSubmitting={isSubmitting} />}
        {showNoticeModal && <PostNoticeModal noticeForm={noticeForm} setNoticeForm={setNoticeForm} onPost={() => postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent)} onCancel={() => setShowNoticeModal(false)} isSubmitting={isSubmitting} />}
        {showMembershipModal && <MembershipModal onSelectPlan={async (...args) => { const sent = await requestMembership(...args); if (sent) setShowMembershipModal(false); }} onCancel={() => setShowMembershipModal(false)} loading={membershipLoading} pendingRequest={pendingMembershipRequest} />}
        {showOwnerProfileModal && ownerProfile && <OwnerProfileModal profile={ownerProfile} onSave={handleSaveOwnerProfile} onCancel={() => setShowOwnerProfileModal(false)} isSubmitting={isSubmitting} />}
        {showComplaintResponseModal && selectedComplaint && <ComplaintResponseModal complaint={selectedComplaint} response={complaintResponse} setResponse={setComplaintResponse} onSend={handleRespondToComplaint} onCancel={() => { setShowComplaintResponseModal(false); setSelectedComplaint(null); setComplaintResponse(''); }} isSubmitting={isSubmitting} />}
        {showRoomChangeReasonModal && selectedRoomChangeRequest && <RoomChangeReasonModal reason={rejectionReason} setReason={setRejectionReason} onReject={handleRejectRoomChange} onCancel={() => { setShowRoomChangeReasonModal(false); setSelectedRoomChangeRequest(null); setRejectionReason(''); }} isSubmitting={isSubmitting} />}
        {showRoomDetailsModal && selectedRoom && <RoomDetailsModal room={selectedRoom} tenantsInRoom={getTenantsInRoom(selectedRoom.id)} onClose={() => setShowRoomDetailsModal(false)} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} fetchTenantPayments={fetchTenantPayments} fetchTenantApplication={fetchTenantApplication} />}
        
        {/* History Modal */}
        {showTenantPaymentsModal && selectedTenantForPayments && (
          <TenantPaymentsModal
            tenant={selectedTenantForPayments}
            payments={tenantPayments}
            onClose={() => setShowTenantPaymentsModal(false)}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}

        {/* Profile Modal */}
        {showTenantProfileModal && selectedProfileTenant && (
          <TenantProfileModal
            tenant={selectedProfileTenant}
            application={tenantApplication}
            loading={loadingProfile}
            onClose={() => setShowTenantProfileModal(false)}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
