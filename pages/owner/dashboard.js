import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getResetPasswordRedirectTo, supabase, signOut, signPrivateDocumentFields, findTenantDocumentRecord } from '../../lib/supabase';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';
import NotificationBell from '../../components/common/NotificationBell';
import ThemeToggle from '../../components/common/ThemeToggle';
import { formatCurrency } from '../../lib/utils';

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
import { useExistingTenantImports } from '../../hooks/useExistingTenantImports';
import { useOwnerAnalytics } from '../../hooks/useOwnerAnalytics';

// Content Components
import StatsCards from '../../components/owner/StatsCards';
import DashboardSectionNav from '../../components/dashboard/DashboardSectionNav';
import MobileTopbar from '../../components/dashboard/MobileTopbar';
import MobileBottomNav from '../../components/dashboard/MobileBottomNav';
import DashboardMoreMenu from '../../components/dashboard/DashboardMoreMenu';
import DashboardSidebar from '../../components/dashboard/DashboardSidebar';
import DashboardIcon from '../../components/dashboard/DashboardIcon';
import AccountMenu from '../../components/dashboard/AccountMenu';
import { resetDashboardScroll } from '../../lib/dashboardScroll';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import OwnerMobileDashboard from '../../components/owner/mobile/OwnerMobileDashboard';
import OwnerMobileRooms from '../../components/owner/mobile/OwnerMobileRooms';
import OwnerMobileTenants from '../../components/owner/mobile/OwnerMobileTenants';
import OwnerMobilePayments from '../../components/owner/mobile/OwnerMobilePayments';
import OwnerMobileMore from '../../components/owner/mobile/OwnerMobileMore';
import OwnerMobileRoomDetailsSheet from '../../components/owner/mobile/OwnerMobileRoomDetailsSheet';

const OWNER_VIEW_KEYS = {
  OVERVIEW: 'overview',
  ANALYTICS: 'analytics',
  ROOMS: 'rooms',
  TENANTS: 'tenants',
  ARCHIVED_TENANTS: 'archived-tenants',
  RENT_PAYMENTS: 'rent-payments',
  PAYMENT_HISTORY: 'payment-history',
  PRE_BOOKINGS: 'pre-bookings',
  APPLICATIONS: 'applications',
  EXISTING_IMPORTS: 'existing-imports',
  COMPLAINTS: 'complaints',
  VACATE: 'vacate',
  ROOM_CHANGE: 'room-change',
  NOTICES: 'notices',
}

const OWNER_VIEW_ALIASES = {
  imports: OWNER_VIEW_KEYS.EXISTING_IMPORTS,
  rent: OWNER_VIEW_KEYS.RENT_PAYMENTS,
  payments: OWNER_VIEW_KEYS.RENT_PAYMENTS,
  history: OWNER_VIEW_KEYS.PAYMENT_HISTORY,
  roomChange: OWNER_VIEW_KEYS.ROOM_CHANGE,
  roomchange: OWNER_VIEW_KEYS.ROOM_CHANGE,
}

const OWNER_VIEW_SET = new Set(Object.values(OWNER_VIEW_KEYS))

const RoomList = dynamic(() => import('../../components/owner/RoomList'));
const TenantTable = dynamic(() => import('../../components/owner/TenantTable'));
const ArchivedTenantList = dynamic(() => import('../../components/owner/ArchivedTenantList'));
const RentPaymentsList = dynamic(() => import('../../components/owner/RentPaymentsList'));
const PaymentHistoryTable = dynamic(() => import('../../components/owner/PaymentHistoryTable'));
const PreBookingList = dynamic(() => import('../../components/owner/PreBookingList'));
const ApplicationList = dynamic(() => import('../../components/owner/ApplicationList'));
const ComplaintList = dynamic(() => import('../../components/owner/ComplaintList'));
const VacateRequestList = dynamic(() => import('../../components/owner/VacateRequestList'));
const NoticeList = dynamic(() => import('../../components/owner/NoticeList'));
const RoomChangeRequestList = dynamic(() => import('../../components/owner/RoomChangeRequestList'));
const ExistingTenantImportList = dynamic(() => import('../../components/owner/ExistingTenantImportList'));
const ExistingTenantImportSettings = dynamic(() => import('../../components/owner/ExistingTenantImportSettings'));
const OwnerAnalytics = dynamic(() => import('../../components/analytics/OwnerAnalytics'));

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
const VacateRejectionModal = dynamic(() => import('../../components/owner/modals/VacateRejectionModal'), { ssr: false });
const ScreenshotModal = dynamic(() => import('../../components/owner/modals/ScreenshotModal'), { ssr: false });
const OwnerProfileModal = dynamic(() => import('../../components/owner/modals/OwnerProfileModal'), { ssr: false });
const ArchivedTenantHistoryModal = dynamic(() => import('../../components/owner/modals/ArchivedTenantHistoryModal'), { ssr: false });

export default function OwnerDashboard() {
  return (
    <OwnerProvider>
      <OwnerDashboardShell />
    </OwnerProvider>
  );
}

function OwnerDashboardShell() {
  const { property } = useOwner();
  return <OwnerDashboardContent key={property?.id || 'no-property'} />;
}

function OwnerDashboardContent() {
  const router = useRouter();
  const core = useOwner();
  const { 
    loading,
    realtimeConnected,
    properties,
    property, 
    selectProperty,
    ownerProfile,
    updateOwnerProfile,
    rooms, 
    setRooms, 
    tenants, 
    archivedTenants,
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
    saveSettings, 
    pendingMembershipRequest,
    requestMembership
  } = core;
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenu, setMobileMenu] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const sectionRef = useRef(null);
  const openSection = (tab) => {
    const nextTab = OWNER_VIEW_ALIASES[tab] || tab;
    if (!OWNER_VIEW_SET.has(nextTab)) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[OwnerDashboard] Unknown owner view key: ${tab}`);
      setActiveTab(OWNER_VIEW_KEYS.OVERVIEW);
    } else {
      setActiveTab(nextTab);
    }
    setMobileMenu(null);
    setProfileMenuOpen(false);
    resetDashboardScroll();
  };

  useEffect(() => {
    if (!property?.id) return undefined;
    const preload = () => {
      [RoomList, TenantTable, RentPaymentsList, PaymentHistoryTable, PreBookingList, ApplicationList, ComplaintList, VacateRequestList, NoticeList, RoomChangeRequestList,
        AddTenantModal, AddRoomModal, CollectRentModal, PostNoticeModal, ComplaintResponseModal, RoomDetailsModal, PaymentConfirmModal, TenantPaymentsModal, TenantProfileModal,
      ].forEach(component => component.preload?.());
    };
    const idleId = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(preload, { timeout: 800 }) : window.setTimeout(preload, 250);
    return () => typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(idleId) : window.clearTimeout(idleId);
  }, [property?.id]);
  
  const { showRoomModal, setShowRoomModal, roomForm, setRoomForm, sharingTypes, addRoom, deleteRoom } = useOwnerRooms(property, rooms, setRooms, setStats);
  const { formData, setFormData, addTenant } = useOwnerTenants(property, rooms, tenants, setTenants, setStats, loadData);
  const propertyReady = Boolean(property?.id);

  useEffect(() => {
    const tab = typeof router.query.tab === 'string' ? router.query.tab : ''
    const nextTab = OWNER_VIEW_ALIASES[tab] || tab
    if (OWNER_VIEW_SET.has(nextTab)) setActiveTab(nextTab)
  }, [router.query.tab])
  const { complaints, respondToComplaint, resolveComplaint } = useOwnerComplaints(property, propertyReady);
  const { vacateRequests, approveVacateRequest, rejectVacateRequest, rejectingId: vacateRejectingId } = useOwnerVacate(property, propertyReady);
  const { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment, refreshPayments } = useOwnerPayments(property, tenants, archivedTenants, setStats, loadData, propertyReady);
  const { notices, postNotice, deleteNotice } = useOwnerNotices(property, propertyReady);
  const { roomChangeRequests, approveRoomChange, rejectRoomChange } = useOwnerRoomChange(property, propertyReady);
  const { applications, approveApplication, rejectApplication, resendPasswordEmail, processingId: applicationProcessingId } = useOwnerApplications(property, propertyReady);
  const { preBookings, approvePreBooking, rejectPreBooking, processingId: prebookingProcessingId } = useOwnerPreBookings(property, propertyReady);
  const existingImports = useExistingTenantImports(property, propertyReady, () => loadData(true));
  const ownerAnalytics = useOwnerAnalytics(property, activeTab === 'analytics');

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
  const [showArchivedHistoryModal, setShowArchivedHistoryModal] = useState(false);
  const [showRoomChangeReasonModal, setShowRoomChangeReasonModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedRoomChangeRequest, setSelectedRoomChangeRequest] = useState(null);
  const [selectedVacateRequest, setSelectedVacateRequest] = useState(null);
  const [confirmingTenant, setConfirmingTenant] = useState(null);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [complaintResponse, setComplaintResponse] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [vacateRejectionReason, setVacateRejectionReason] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [collectionRequestId, setCollectionRequestId] = useState(null);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });

  // Modal States for History & Profile
  const [showTenantPaymentsModal, setShowTenantPaymentsModal] = useState(false);
  const [showTenantProfileModal, setShowTenantProfileModal] = useState(false);
  const [selectedTenantForPayments, setSelectedTenantForPayments] = useState(null);
  const [selectedProfileTenant, setSelectedProfileTenant] = useState(null);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [tenantApplication, setTenantApplication] = useState(null);  const [tenantExtraDocuments, setTenantExtraDocuments] = useState([]);  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [archivedHistory, setArchivedHistory] = useState(null);
  const [loadingArchivedTenantId, setLoadingArchivedTenantId] = useState(null);
  const profileCache = useRef(new Map());
  const paymentCache = useRef(new Map());
  const hasOpenOverlay = showPaymentModal || showConfirmDeleteModal || showSettingsModal || showAddModal || showRoomModal || showNoticeModal || showMembershipModal || showOwnerProfileModal || showArchivedHistoryModal || showComplaintResponseModal || showRoomChangeReasonModal || Boolean(selectedVacateRequest) || showPaymentConfirmModal || showRoomDetailsModal || showTenantPaymentsModal || showTenantProfileModal || showScreenshotModal || profileMenuOpen || mobileMenu === 'more';
  useBodyScrollLock(hasOpenOverlay);

  // ----------------------------------------------------------------
  // FETCH FUNCTIONS FOR HISTORY & PROFILE
  // ----------------------------------------------------------------
  const fetchTenantPayments = async (tenant) => {
    setSelectedTenantForPayments(tenant);
    setShowTenantPaymentsModal(true);
    if (paymentCache.current.has(tenant.id)) { setTenantPayments(paymentCache.current.get(tenant.id)); return; }
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      const signed = await Promise.all((data || []).map(item => signPrivateDocumentFields(item, ['payment_screenshot'])));
      paymentCache.current.set(tenant.id, signed);
      setTenantPayments(signed);
    } catch (error) {
      toast.error('Failed to load payment history');
    } finally { setLoadingPayments(false); }
  };

  const fetchTenantApplication = async (tenant) => {
    setSelectedProfileTenant(tenant);
    setShowTenantProfileModal(true);
    if (profileCache.current.has(tenant.id)) {
      const cached = profileCache.current.get(tenant.id);
      setSelectedProfileTenant(cached.tenant);
      setTenantApplication(cached.application);
      setTenantExtraDocuments(cached.extraDocuments || []);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const [tenantResult, paymentHistoryResult] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', tenant.id).eq('property_id', property.id).single(),
        supabase.from('payment_history')
          .select('id, payment_screenshot, payment_date, payment_method, status')
          .eq('tenant_id', tenant.id)
          .order('payment_date', { ascending: false })
          .limit(10),
      ]);
      if (tenantResult.error) throw tenantResult.error;
      if (paymentHistoryResult.error) throw paymentHistoryResult.error;
      const fullTenant = tenantResult.data;
      const signedTenant = await signPrivateDocumentFields(fullTenant, ['payment_screenshot']);
      const { record, source_type } = await findTenantDocumentRecord(fullTenant, property.id);
      const signed = record ? await signPrivateDocumentFields({ ...record, source_type }, ['id_proof', 'photo', 'payment_screenshot']) : null;
      const signedHistory = await Promise.all((paymentHistoryResult.data || []).map(item => signPrivateDocumentFields(item, ['payment_screenshot'])));
      const extraDocuments = signedHistory
        .filter(item => item.payment_screenshot)
        .map((item, index) => ({ label: `Payment receipt ${index + 1}`, url: item.payment_screenshot }));
      profileCache.current.set(tenant.id, { tenant: signedTenant, application: signed, extraDocuments });
      setSelectedProfileTenant(signedTenant);
      setTenantApplication(signed);
      setTenantExtraDocuments(extraDocuments);
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
      const redirectTo = getResetPasswordRedirectTo();
      if (process.env.NODE_ENV !== 'production') {
        console.info('[HostelSet] reset link requested', { method: 'resetPasswordForEmail', redirectTo });
      }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        appData.email,
        { redirectTo }
      );

      if (resetError) {
        toast.warning("Tenant created, but password reset email could not be sent.");
      } else {
        toast.success("Password reset email sent to the tenant.");
      }

      toast.success(`${appData.name} approved. Tenant created.`);
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

  const handleCollectRent = async () => {
    if (isSubmitting || !selectedTenant || !collectionRequestId) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid collection amount'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('record_owner_rent_collection', {
        p_tenant_id: selectedTenant.id,
        p_amount: amount,
        p_collection_id: collectionRequestId,
      });
      if (error) throw error;
      await Promise.all([loadData(true), refreshPayments()]);
      toast.success('Rent collection recorded');
      setShowPaymentModal(false);
      setSelectedTenant(null);
      setPaymentAmount('');
      setCollectionRequestId(null);
    } catch (error) {
      toast.error('Failed to collect rent: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchArchivedTenantHistory = async (tenant) => {
    if (loadingArchivedTenantId) return;
    setLoadingArchivedTenantId(tenant.id);
    setArchivedHistory(null);
    setShowArchivedHistoryModal(true);
    try {
      const { data, error } = await supabase.rpc('get_archived_tenant_history', { p_tenant_id: tenant.id });
      if (error) throw error;
      setArchivedHistory(data);
    } catch (error) {
      toast.error('Failed to load archived tenant history: ' + error.message);
      setShowArchivedHistoryModal(false);
    } finally {
      setLoadingArchivedTenantId(null);
    }
  };

  const openPaymentConfirmation = (tenant) => {
    const pendingPayment = safePendingRentPayments.find(payment => payment.tenant_id === tenant.id);
    if (!pendingPayment) {
      toast.error('This tenant has no payment awaiting confirmation.');
      return;
    }
    setConfirmingTenant({
      ...tenant,
      pendingPaymentId: pendingPayment.id,
      upi_transaction_id: pendingPayment.upi_transaction_id,
      payment_screenshot: pendingPayment.payment_screenshot,
    });
    setShowPaymentConfirmModal(true);
  };

  const handleConfirmPendingPayment = async () => {
    if (isSubmitting || !confirmingTenant?.pendingPaymentId) return;
    setIsSubmitting(true);
    try {
      const confirmed = await confirmRentPayment(confirmingTenant.pendingPaymentId);
      if (confirmed) {
        setShowPaymentConfirmModal(false);
        setConfirmingTenant(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveTenant = async () => {
    if (isSubmitting || !tenantToDelete) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('archive_tenant', { p_tenant_id: tenantToDelete.id });
      if (error) throw error;
      profileCache.current.delete(tenantToDelete.id);
      paymentCache.current.delete(tenantToDelete.id);
      await loadData(true);
      toast.success('Tenant removed from the active room and archived');
      setShowConfirmDeleteModal(false);
      setTenantToDelete(null);
    } catch (error) {
      toast.error('Failed to remove tenant: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleApproveRoomChange = async (request) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try { await approveRoomChange(request); }
    finally { setIsSubmitting(false); }
  };

  const handleApproveVacate = async (requestId, tenantId, expectedDate) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try { await approveVacateRequest(requestId, tenantId, expectedDate); }
    finally { setIsSubmitting(false); }
  };

  const handleResolveComplaint = async (complaintId) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try { await resolveComplaint(complaintId); }
    finally { setIsSubmitting(false); }
  };

  const handleReviewRentPayment = async (paymentId, approve) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      return approve ? await confirmRentPayment(paymentId) : await rejectRentPayment(paymentId);
    } finally { setIsSubmitting(false); }
  };

  const openSignedPaymentScreenshot = async (proof) => {
    try {
      const record = typeof proof === 'string' ? { payment_screenshot: proof } : proof
      const sourceRecord = record?.payment_screenshot_url && !record?.payment_screenshot
        ? { ...record, source_type: 'application' }
        : record
      const signed = await signPrivateDocumentFields(sourceRecord, ['payment_screenshot'])
      const url = signed?.payment_screenshot || record?.payment_screenshot_url || null
      if (!url) {
        toast.error('Payment proof is unavailable.')
        return
      }
      setScreenshotUrl(url)
      setShowScreenshotModal(true)
    } catch {
      toast.error('Unable to open payment proof. Please try again.')
    }
  };

  const handlePostNotice = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const posted = await postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent);
      if (posted) {
        setNoticeForm({ title:'', content:'', type:'general', is_urgent:false });
        setShowNoticeModal(false);
      }
    } finally { setIsSubmitting(false); }
  };

  if (loading) {
    return <DashboardSkeleton cards={12} />
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="bg-[#1a1a1a] border-b border-orange-500/30 px-6 py-4 flex justify-between items-center text-white">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <NotificationBell />
            <button onClick={async () => { await signOut(); window.location.replace('/login') }} className="text-red-400 hover:text-red-300 transition">Logout</button>
          </div>
        </nav>
        <div className="text-center py-20">
          <DashboardIcon name="home" className="mx-auto mb-6 h-16 w-16 text-orange-500" />
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
  const safeArchivedTenants = Array.isArray(archivedTenants) ? archivedTenants : []
  const safeAllPayments = Array.isArray(allPayments) ? allPayments : []
  const safePendingRentPayments = Array.isArray(pendingRentPayments) ? pendingRentPayments : []
  const safeComplaints = Array.isArray(complaints) ? complaints : []
  const safeVacateRequests = Array.isArray(vacateRequests) ? vacateRequests : []
  const safeNotices = Array.isArray(notices) ? notices : []
  const safeRoomChangeRequests = Array.isArray(roomChangeRequests) ? roomChangeRequests : []
  const safeApplications = Array.isArray(applications) ? applications : []
  const safePreBookings = Array.isArray(preBookings) ? preBookings : []
  const safeExistingImports = Array.isArray(existingImports.imports) ? existingImports.imports : []

  const searchLower = searchTerm.trim().toLowerCase()
  const matchesSearch = (...values) => !searchLower || values.some(value => String(value ?? '').toLowerCase().includes(searchLower))
  const filteredRooms = safeRooms.filter(room => matchesSearch(room.room_number, room.status, room.sharing_type, room.room_audience))
  const filteredTenants = safeTenants.filter(tenant => matchesSearch(tenant.name, tenant.phone, tenant.email, tenant.room_number, tenant.pending_amount, tenant.rent_status, tenant.status, tenant.dueStatus?.status))
  const filteredArchivedTenants = safeArchivedTenants.filter(tenant => matchesSearch(tenant.name, tenant.phone, tenant.email, tenant.room_number))
  const filteredPendingPayments = safePendingRentPayments.filter(payment => matchesSearch(payment.tenants?.name, payment.tenants?.phone, payment.tenants?.email, payment.tenants?.rooms?.room_number, payment.amount, payment.status, payment.upi_transaction_id))
  const filteredAllPayments = safeAllPayments.filter(payment => matchesSearch(payment.tenants?.name, payment.tenants?.phone, payment.tenants?.email, payment.tenants?.rooms?.room_number, payment.amount, payment.status, payment.payment_method, payment.upi_transaction_id))
  const filteredApplications = safeApplications.filter(application => matchesSearch(application.name, application.phone, application.email, application.status, application.rooms?.room_number, application.payment_transaction_id))
  const filteredExistingImports = safeExistingImports.filter(item => matchesSearch(item.full_name, item.phone, item.email, item.status, item.room_number, item.occupation))
  const filteredPreBookings = safePreBookings.filter(booking => matchesSearch(booking.name, booking.phone, booking.email, booking.status, booking.room_number, booking.payment_transaction_id))
  const filteredComplaints = safeComplaints.filter(complaint => matchesSearch(complaint.tenant_name, complaint.room_number, complaint.title, complaint.description, complaint.priority, complaint.status, complaint.admin_response))
  const filteredNotices = safeNotices.filter(notice => matchesSearch(notice.title, notice.content, notice.type))
  const filteredVacateRequests = safeVacateRequests.filter(request => matchesSearch(request.tenant_name, request.room_number, request.status, request.reason, request.expected_check_out))
  const filteredRoomChangeRequests = safeRoomChangeRequests.filter(request => matchesSearch(request.tenants?.name, request.tenants?.phone, request.tenants?.email, request.old_room?.room_number, request.new_room?.room_number, request.reason, request.status))
  const searchGroups = [
    ['tenants', 'Tenants', filteredTenants.length],
    ['archived-tenants', 'Archived tenants', filteredArchivedTenants.length],
    ['rooms', 'Rooms', filteredRooms.length],
    ['rent-payments', 'Pending payments', filteredPendingPayments.length],
    ['payment-history', 'Payment history', filteredAllPayments.length],
    ['applications', 'Applications', filteredApplications.length],
    ['existing-imports', 'Existing tenant imports', filteredExistingImports.length],
    ['pre-bookings', 'Pre-bookings', filteredPreBookings.length],
    ['complaints', 'Complaints', filteredComplaints.length],
    ['notices', 'Notices', filteredNotices.length],
    ['vacate', 'Vacate requests', filteredVacateRequests.length],
    ['room-change', 'Room changes', filteredRoomChangeRequests.length],
  ].filter(([, , count]) => count > 0)
  const ownerTabs = [
    ['overview', 'Overview'], ['analytics', 'Analytics'], ['rooms', `Rooms (${rooms.length})`], ['tenants', `Tenants (${tenants.length})`],
    ['archived-tenants', `Archived (${archivedTenants.length})`], ['rent-payments', `Rent (${stats.pendingRentConfirmations})`], ['payment-history', 'History'],
    ['pre-bookings', 'Pre-bookings'], ['applications', `Applications (${safeApplications.length})`], ['existing-imports', `Imports (${existingImports.pendingCount})`],
    ['complaints', `Complaints (${stats.totalComplaints || 0})`], ['vacate', `Vacate (${stats.pendingVacate || 0})`], ['room-change', `Room change (${roomChangeRequests.length})`], ['notices', `Notices (${notices.length})`],
  ].map(([id, label]) => ({ id, label }))
  const ownerViewTitle = ownerTabs.find(item => item.id === activeTab)?.label.replace(/ \(.*\)$/, '') || 'Dashboard'
  const ownerBottomItems = [
    { id: 'overview', label: 'Dashboard', icon: 'dashboard' }, { id: 'rooms', label: 'Rooms', icon: 'rooms' }, { id: 'tenants', label: 'Tenants', icon: 'users' },
    { id: 'rent-payments', label: 'Payments', icon: 'payments' }, { id: 'more', label: 'More', icon: 'more' },
  ]
  const ownerBottomIcons = { overview: 'dashboard', rooms: 'rooms', tenants: 'users', 'rent-payments': 'payments', more: 'more' }
  ownerBottomItems.forEach(item => { item.icon = ownerBottomIcons[item.id] })
  const ownerSidebarItems = ownerTabs.map(item => ({ ...item, icon: ({ overview:'dashboard', rooms:'rooms', tenants:'users', 'rent-payments':'payments', 'payment-history':'payments', notices:'notices', complaints:'complaints', analytics:'analytics' })[item.id] || 'settings', disabled: !membershipActive && item.id !== 'overview' }))
  const logout = async () => { await signOut(); window.location.replace('/login') }
  const renderOwnerOverview = () => (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl border border-orange-500/20 bg-slate-950 p-4 text-white shadow-lg lg:hidden" aria-label="Current property summary">
        <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Current property</p><h1 className="mt-1 truncate text-xl font-bold">{property.name}</h1><p className="mt-1 text-sm text-slate-400">{stats.occupied || 0} occupied / {stats.vacant || 0} available</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${membershipActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{membershipActive ? 'Active' : 'Inactive'}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-400">Collected</p><p className="mt-1 truncate font-bold">{formatCurrency(stats.totalCollected || 0)}</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-400">Pending rent</p><p className="mt-1 truncate font-bold text-orange-300">{formatCurrency(stats.pendingAmount || 0)}</p></div></div>
        {properties.length > 1 && <select aria-label="Switch current property" value={property.id} onChange={event => selectProperty(event.target.value)} className="mt-3 w-full max-w-full truncate rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white">{properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
      </section>
      <StatsCards stats={{ ...stats, tenantCount: safeTenants.length, activeNotices: safeNotices.length, pendingApplications: safeApplications.length, pendingImports: existingImports.pendingCount, totalComplaints: safeComplaints.length, pendingVacate: safeVacateRequests.filter(request => request.status === 'pending').length, pendingRoomChanges: safeRoomChangeRequests.length, pendingRentConfirmations: safePendingRentPayments.length }} onSelect={openSection} />
      <section className="mb-4 md:hidden" aria-labelledby="owner-action-required"><h2 id="owner-action-required" className="mb-2 text-base font-bold text-slate-900">Action required</h2><div className="grid grid-cols-2 gap-2">{[
        ['rent-payments', 'Pending payments', safePendingRentPayments.length], ['applications', 'Applications', safeApplications.length],
        ['complaints', 'Complaints', safeComplaints.length], ['vacate', 'Vacate requests', safeVacateRequests.filter(item => item.status === 'pending').length],
        ['room-change', 'Room changes', safeRoomChangeRequests.length], ['existing-imports', 'Existing imports', existingImports.pendingCount],
      ].map(([tab, label, count]) => <button key={tab} type="button" onClick={() => openSection(tab)} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"><span className="min-w-0 text-xs font-semibold text-slate-600">{label}</span><span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{count}</span></button>)}</div></section>
      {searchLower && (
        <div className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700">Search results for "{searchTerm.trim()}"</p>
          {searchGroups.length ? <div className="flex flex-wrap gap-2">{searchGroups.map(([tab, label, count]) => <button key={tab} onClick={() => openSection(tab)} className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100">{label} ({count})</button>)}</div> : <p className="text-sm text-gray-500">No matching dashboard records.</p>}
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="owner-quick-actions">
        <div className="mb-3"><h2 id="owner-quick-actions" className="font-bold text-slate-800">Quick actions</h2><p className="text-sm text-slate-500">Manage this property without leaving your current workspace.</p></div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
          <button onClick={() => membershipActive && setShowAddModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-md ${membershipActive ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>+ Add Tenant</button>
          <button onClick={() => membershipActive && setShowRoomModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Add Room</button>
          <button onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Notice</button>
          <button onClick={() => router.push('/owner/register-property')} className="w-full rounded-full border-2 border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden">+ Add Property</button>
        </div>
      </section>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-4">Membership</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-gray-500">Status</p><p className="font-semibold capitalize text-slate-800">{membershipStatus === 'active' ? 'Active' : membershipStatus === 'expired' ? 'Expired' : 'Inactive'}</p></div>
            <div><p className="text-gray-500">Expiry Date</p><p className="font-semibold text-slate-800">{membershipExpiry ? membershipExpiry.toLocaleDateString('en-IN') : 'Not available'}</p></div>
            <div><p className="text-gray-500">Remaining Days</p><p className="font-semibold text-slate-800">{daysLeft == null ? 'Not available' : Math.max(0, daysLeft)}</p></div>
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Active Notices</h2>
          <NoticeList notices={safeNotices.slice(0, 5)} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  )
  const renderOwnerView = () => {
    switch (activeTab) {
      case 'overview': return renderOwnerOverview()
      case 'analytics': return <OwnerAnalytics rooms={safeRooms} tenants={safeTenants} archivedTenants={safeArchivedTenants} payments={safeAllPayments} pendingPayments={safePendingRentPayments} applications={ownerAnalytics.applications} existingImports={ownerAnalytics.imports} complaints={safeComplaints} notices={safeNotices} vacateRequests={safeVacateRequests} roomChangeRequests={safeRoomChangeRequests} />
      case 'rooms': return <RoomList rooms={filteredRooms} tenants={safeTenants} vacateRequests={safeVacateRequests} roomMonthlyIncome={roomMonthlyIncome} onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} onDeleteRoom={(id) => deleteRoom(id, isSubmitting, setIsSubmitting)} isSubmitting={isSubmitting} />
      case 'tenants': return <TenantTable tenants={filteredTenants} vacateRequests={safeVacateRequests} onCollect={(tenant) => { setSelectedTenant(tenant); setPaymentAmount(Number(tenant.pending_amount || tenant.rent_amount || 0)); setCollectionRequestId(crypto.randomUUID()); setShowPaymentModal(true) }} onHistory={fetchTenantPayments} onProfile={fetchTenantApplication} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={openPaymentConfirmation} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />
      case 'archived-tenants': return <ArchivedTenantList tenants={filteredArchivedTenants} onViewHistory={fetchArchivedTenantHistory} loadingId={loadingArchivedTenantId} />
      case 'rent-payments': return <RentPaymentsList payments={filteredPendingPayments} onConfirm={(id) => handleReviewRentPayment(id, true)} onReject={(id) => handleReviewRentPayment(id, false)} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={isSubmitting} />
      case 'payment-history': return <PaymentHistoryTable payments={filteredAllPayments} getRoomNumberById={getRoomNumberById} onViewScreenshot={openSignedPaymentScreenshot} />
      case 'pre-bookings': return <PreBookingList bookings={filteredPreBookings} onApprove={(id, data) => approvePreBooking(id, data)} onReject={rejectPreBooking} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={Boolean(prebookingProcessingId)} />
      case 'applications': return <ApplicationList applications={filteredApplications} onApprove={(id, data) => approveApplication(id, data)} onReject={rejectApplication} onResendEmail={resendPasswordEmail} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={Boolean(applicationProcessingId)} />
      case 'existing-imports': return <div className="space-y-5"><ExistingTenantImportSettings link={existingImports.link} property={property} busy={existingImports.linkBusy} onGenerate={existingImports.rotateLink} onToggle={existingImports.setLinkEnabled} /><ExistingTenantImportList imports={filteredExistingImports} loading={existingImports.loading} total={existingImports.total} page={existingImports.page} pageSize={existingImports.pageSize} processingId={existingImports.processingId} onApprove={existingImports.approve} onReject={existingImports.reject} onPage={existingImports.loadPage} /></div>
      case 'complaints': return <ComplaintList complaints={filteredComplaints} onRespond={(complaint) => { setSelectedComplaint(complaint); setComplaintResponse(''); setShowComplaintResponseModal(true) }} onResolve={handleResolveComplaint} isSubmitting={isSubmitting} />
      case 'vacate': return <VacateRequestList requests={filteredVacateRequests} onApprove={handleApproveVacate} onReject={(request) => { setSelectedVacateRequest(request); setVacateRejectionReason(''); }} isSubmitting={isSubmitting || Boolean(vacateRejectingId)} />
      case 'room-change': return <RoomChangeRequestList requests={filteredRoomChangeRequests} onApprove={handleApproveRoomChange} onReject={(request) => { setSelectedRoomChangeRequest(request); setRejectionReason(''); setShowRoomChangeReasonModal(true) }} isSubmitting={isSubmitting} />
      case 'notices': return <NoticeList notices={filteredNotices} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />
      default:
        if (process.env.NODE_ENV !== 'production') console.warn(`[OwnerDashboard] No renderer for owner view key: ${activeTab}`)
        return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">This owner section is not available. Please choose another section from the menu.</div>
    }
  }
  const ownerMobileMoreItems = [
    { id: 'dashboard', group: 'Management', label: 'Dashboard', onClick: () => openSection('overview') },
    { id: 'rooms', group: 'Management', label: 'Rooms', onClick: () => openSection('rooms') },
    { id: 'tenants', group: 'Management', label: 'Tenants', onClick: () => openSection('tenants') },
    { id: 'archived-tenants', group: 'Management', label: `Archived tenants (${safeArchivedTenants.length})`, onClick: () => openSection('archived-tenants') },
    { id: 'rent-payments', group: 'Management', label: 'Payments', onClick: () => openSection('rent-payments') },
    { id: 'payment-history', group: 'Management', label: 'Payment history', onClick: () => openSection('payment-history') },
    { id: 'applications', group: 'Requests', label: `Applications (${safeApplications.length})`, onClick: () => openSection('applications') },
    { id: 'imports', group: 'Requests', label: `Existing imports (${existingImports.pendingCount})`, onClick: () => openSection('existing-imports') },
    { id: 'pre-bookings', group: 'Requests', label: `Pre-bookings (${safePreBookings.length})`, onClick: () => openSection('pre-bookings') },
    { id: 'complaints', group: 'Requests', label: 'Complaints', onClick: () => openSection('complaints') },
    { id: 'vacate', group: 'Requests', label: 'Vacate requests', onClick: () => openSection('vacate') },
    { id: 'change', group: 'Requests', label: 'Room changes', onClick: () => openSection('room-change') },
    { id: 'notices', group: 'Communication', label: 'Notices', onClick: () => openSection('notices') },
    { id: 'notifications', group: 'Communication', label: 'Notifications', onClick: () => window.dispatchEvent(new Event('hostelset:open-notifications')) },
    { id: 'analytics', group: 'Insights', label: 'Analytics', onClick: () => openSection('analytics') },
    { id: 'profile', group: 'Account', label: 'Owner profile', onClick: () => setShowOwnerProfileModal(true) },
    { id: 'settings', group: 'Account', label: 'Property settings', onClick: () => setShowSettingsModal(true) },
    { id: 'add-property', group: 'Account', label: 'Add property', onClick: () => router.push('/owner/register-property') },
    { id: 'logout', group: 'Account', label: 'Logout', danger: true, onClick: async () => { await signOut(); window.location.replace('/login') } },
  ]
  const renderOwnerMobileView = () => {
    const common = { property, avatar: ownerProfile?.full_name?.charAt(0) || 'O', onProfile: () => setProfileMenuOpen(value => !value) }
    if (activeTab === 'rooms') return <OwnerMobileRooms {...common} rooms={filteredRooms} tenants={safeTenants} onBack={() => openSection('overview')} onAddRoom={() => membershipActive && setShowRoomModal(true)} onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} onDeleteRoom={(id) => deleteRoom(id, isSubmitting, setIsSubmitting)} isSubmitting={isSubmitting} />
    if (activeTab === 'tenants') return <OwnerMobileTenants {...common} tenants={filteredTenants} onBack={() => openSection('overview')} onAddTenant={() => membershipActive && setShowAddModal(true)} onCollect={(tenant) => { setSelectedTenant(tenant); setPaymentAmount(Number(tenant.pending_amount || tenant.rent_amount || 0)); setCollectionRequestId(crypto.randomUUID()); setShowPaymentModal(true) }} onHistory={fetchTenantPayments} onTenantProfile={fetchTenantApplication} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={openPaymentConfirmation} />
    if (activeTab === 'rent-payments') return <OwnerMobilePayments {...common} payments={filteredPendingPayments} onBack={() => openSection('overview')} onConfirm={(id) => handleReviewRentPayment(id, true)} onReject={(id) => handleReviewRentPayment(id, false)} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={isSubmitting} />
    if (activeTab === 'overview') return <OwnerMobileDashboard {...common} stats={stats} counts={{ tenants: safeTenants.length, applications: safeApplications.length, complaints: safeComplaints.length, payments: safePendingRentPayments.length, vacate: safeVacateRequests.filter(item => item.status === 'pending').length, roomChanges: safeRoomChangeRequests.length }} onNavigate={openSection} />
    return (
      <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
        <MobileTopbar title={ownerViewTitle} subtitle={property?.name} isHome={false} onBack={() => openSection('overview')} onProfile={() => setProfileMenuOpen(value => !value)} avatar="" fallbackIcon="users" controls={<NotificationBell listenForGlobalOpen />} />
        <main className="mx-auto max-w-md space-y-2 px-3 py-2">
          {activeTab === 'notices' && <button type="button" onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive || isSubmitting} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-sm disabled:opacity-50">+ Add Notice</button>}
          {renderOwnerView()}
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-shell min-h-screen max-w-full overflow-x-hidden bg-[#f8f9fa] font-sans">
      <div className="lg:hidden">
        {renderOwnerMobileView()}
        <OwnerMobileRoomDetailsSheet
          room={showRoomDetailsModal ? selectedRoom : null}
          tenants={selectedRoom ? getTenantsInRoom(selectedRoom.id) : []}
          onClose={() => setShowRoomDetailsModal(false)}
          onAddTenant={() => { setShowRoomDetailsModal(false); membershipActive && setShowAddModal(true); }}
          onUpdated={async (updated) => { setRooms(current => current.map(room => room.id === updated.id ? updated : room)); setSelectedRoom(updated); await loadData(true); }}
        />
        <AccountMenu open={profileMenuOpen} onClose={() => setProfileMenuOpen(false)} name={ownerProfile?.full_name || 'Owner'} subtitle={property?.name} avatar="" fallbackIcon="users" actions={[{label:'Edit profile',onClick:()=>setShowOwnerProfileModal(true)},{label:'Property settings',onClick:()=>setShowSettingsModal(true)},{label:'Add property',onClick:()=>router.push('/owner/register-property')},{label:'Logout',onClick:logout,danger:true}]}/>
        <MobileBottomNav items={ownerBottomItems} activeId={mobileMenu === 'more' ? 'more' : activeTab} onSelect={id => { if (id === 'more') setMobileMenu('more'); else { setMobileMenu(null); openSection(id) } }} />
        <OwnerMobileMore open={mobileMenu === 'more'} subtitle={property?.name} onClose={() => setMobileMenu(null)} items={ownerMobileMoreItems} />
      </div>
      <DashboardSidebar role="Owner" items={ownerSidebarItems} activeId={activeTab} onSelect={openSection} footer={<div><p className="truncate text-sm font-bold text-white">{property.name}</p><p className="mt-1 text-xs text-slate-400">{membershipActive?'Membership active':'Membership inactive'}</p></div>}/>
      
      {/* --- NAVBAR (Premium Onyx & Gold) --- */}
      <nav className="dashboard-desktop-header">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo priority />
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap flex-1 min-w-0">
            <span className={`hidden sm:inline-flex items-center gap-2 text-xs font-semibold ${realtimeConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
            <div className="relative order-last w-full sm:w-48 md:w-64 lg:order-none">
              <DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="search" aria-label="Search dashboard" placeholder="Search dashboard..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-gray-700/50 bg-[#2a2a2a] py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 transition focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <button type="button" onClick={() => setShowMembershipModal(true)} disabled={Boolean(pendingMembershipRequest)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm transition ${membershipActive ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : pendingMembershipRequest ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-wait' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
              {membershipActive ? 'Active' : pendingMembershipRequest ? 'Approval Pending' : 'Request Membership'}
            </button>
            {membershipExpiry && <span className="hidden items-center gap-1.5 rounded-full border border-gray-700/60 bg-[#2a2a2a] px-3 py-1.5 text-xs font-semibold text-gray-300 md:inline-flex"><DashboardIcon name="calendar" className="h-4 w-4" />{membershipExpiry.toLocaleDateString('en-IN')}</span>}
            <button type="button" title="Edit owner profile" onClick={() => setShowOwnerProfileModal(true)} className="rounded-lg px-3 py-1.5 text-gray-400 transition hover:bg-white/5 hover:text-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400" aria-label="Edit owner profile"><DashboardIcon name="users" className="h-4 w-4" /></button>
            <button type="button" title="Open property settings" onClick={() => setShowSettingsModal(true)} className="rounded-lg px-3 py-1.5 text-gray-400 transition hover:bg-white/5 hover:text-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400" aria-label="Open property settings"><DashboardIcon name="settings" className="h-4 w-4" /></button>
            {properties.length > 1 ? (
              <select aria-label="Current property" value={property.id} onChange={(event) => selectProperty(event.target.value)} className="max-w-48 rounded-lg border border-orange-500/30 bg-[#2a2a2a] px-3 py-1.5 text-sm text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500">
                {properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            ) : (
              <span className="text-sm hidden md:inline text-orange-300/80">{property.name}</span>
            )}
            <Link href="/owner/register-property" className="rounded-lg border border-orange-500/30 px-3 py-1.5 text-sm font-semibold text-orange-300 hover:bg-white/5">
              + Add Property
            </Link>
            <button type="button" title="Logout" onClick={async () => { await signOut(); window.location.replace('/login') }} className="text-red-400 hover:text-red-300 transition font-medium">Logout</button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main container mx-auto hidden min-w-0 px-3 py-5 sm:px-4 sm:py-8 lg:block">
        {activeTab === 'overview' && <section className="mb-3 rounded-2xl border border-orange-500/20 bg-slate-950 p-3 text-white shadow-lg lg:hidden" aria-label="Current property summary">
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-orange-400">Current property</p><h1 className="mt-1 truncate text-xl font-bold">{property.name}</h1><p className="mt-1 text-sm text-slate-400">{stats.occupied || 0} occupied / {stats.vacant || 0} available</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${membershipActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{membershipActive ? 'Active' : 'Inactive'}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/10 p-2"><p className="text-[10px] text-slate-400">Collected</p><p className="truncate text-sm font-bold">{formatCurrency(stats.totalCollected || 0)}</p></div><div className="rounded-xl bg-white/10 p-2"><p className="text-[10px] text-slate-400">Pending rent</p><p className="truncate text-sm font-bold text-orange-300">{formatCurrency(stats.pendingAmount || 0)}</p></div></div>
          {properties.length > 1 && <select aria-label="Switch current property" value={property.id} onChange={event => selectProperty(event.target.value)} className="mt-3 w-full max-w-full truncate rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white">{properties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        </section>}
        
        {/* --- STATS CARDS --- */}
        {activeTab === 'overview' && <div><StatsCards stats={{ ...stats, tenantCount: safeTenants.length, activeNotices: safeNotices.length, pendingApplications: safeApplications.length, pendingImports: existingImports.pendingCount, totalComplaints: safeComplaints.length, pendingVacate: safeVacateRequests.filter(request => request.status === 'pending').length, pendingRoomChanges: safeRoomChangeRequests.length, pendingRentConfirmations: safePendingRentPayments.length }} onSelect={openSection} /></div>}

        {activeTab === 'overview' && <section className="mb-4 md:hidden" aria-labelledby="owner-action-required"><h2 id="owner-action-required" className="mb-2 text-base font-bold text-slate-900">Action required</h2><div className="grid grid-cols-2 gap-2">{[
          ['rent-payments', 'Pending payments', safePendingRentPayments.length], ['applications', 'Applications', safeApplications.length],
          ['complaints', 'Complaints', safeComplaints.length], ['vacate', 'Vacate requests', safeVacateRequests.filter(item => item.status === 'pending').length],
          ['room-change', 'Room changes', safeRoomChangeRequests.length], ['existing-imports', 'Existing imports', existingImports.pendingCount],
        ].map(([tab, label, count]) => <button key={tab} type="button" onClick={() => openSection(tab)} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"><span className="min-w-0 text-xs font-semibold text-slate-600">{label}</span><span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{count}</span></button>)}</div></section>}

        {activeTab === 'overview' && searchLower && (
          <div className="mb-6 rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">Search results for "{searchTerm.trim()}"</p>
            {searchGroups.length ? <div className="flex flex-wrap gap-2">{searchGroups.map(([tab, label, count]) => <button key={tab} onClick={() => openSection(tab)} className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100">{label} ({count})</button>)}</div> : <p className="text-sm text-gray-500">No matching dashboard records.</p>}
          </div>
        )}

        {/* --- ACTION BUTTONS (Glassmorphism) --- */}
        {activeTab === 'overview' && <section className="mb-6 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block" aria-labelledby="owner-quick-actions">
          <div className="mb-3"><h2 id="owner-quick-actions" className="font-bold text-slate-800">Quick actions</h2><p className="text-sm text-slate-500">Manage this property without leaving your current workspace.</p></div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
          <button onClick={() => membershipActive && setShowAddModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-md ${membershipActive ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>+ Add Tenant</button>
          <button onClick={() => membershipActive && setShowRoomModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Add Room</button>
          <button onClick={() => membershipActive && setShowNoticeModal(true)} disabled={!membershipActive} className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-sm font-semibold transition shadow-sm border-2 ${membershipActive ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}>+ Notice</button>
          <button onClick={() => router.push('/owner/register-property')} className="w-full rounded-full border-2 border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden">+ Add Property</button>
        </div></section>}

        {/* --- TABS --- */}
        <div className="hidden"><DashboardSectionNav label="Owner dashboard sections" items={ownerTabs} activeId={activeTab} onSelect={openSection} disabled={!membershipActive} /></div>

        {/* --- TAB CONTENT --- */}
        <div ref={sectionRef} className="scroll-mt-28">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="hidden bg-white rounded-xl border border-gray-100 p-5 shadow-sm lg:block">
              <h2 className="font-semibold text-slate-800 mb-4">Membership</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div><p className="text-gray-500">Status</p><p className="font-semibold capitalize text-slate-800">{membershipStatus === 'active' ? 'Active' : membershipStatus === 'expired' ? 'Expired' : 'Inactive'}</p></div>
                <div><p className="text-gray-500">Expiry Date</p><p className="font-semibold text-slate-800">{membershipExpiry ? membershipExpiry.toLocaleDateString('en-IN') : 'Not available'}</p></div>
                <div><p className="text-gray-500">Remaining Days</p><p className="font-semibold text-slate-800">{daysLeft == null ? 'Not available' : Math.max(0, daysLeft)}</p></div>
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 mb-3">Active Notices</h2>
              <NoticeList notices={safeNotices.slice(0, 5)} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />
            </div>
          </div>
        )}
        {activeTab === 'analytics' && <OwnerAnalytics rooms={safeRooms} tenants={safeTenants} archivedTenants={safeArchivedTenants} payments={safeAllPayments} pendingPayments={safePendingRentPayments} applications={ownerAnalytics.applications} existingImports={ownerAnalytics.imports} complaints={safeComplaints} notices={safeNotices} vacateRequests={safeVacateRequests} roomChangeRequests={safeRoomChangeRequests} />}
        {activeTab === 'rooms' && <RoomList rooms={filteredRooms} tenants={safeTenants} vacateRequests={safeVacateRequests} roomMonthlyIncome={roomMonthlyIncome} onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} onDeleteRoom={(id) => deleteRoom(id, isSubmitting, setIsSubmitting)} isSubmitting={isSubmitting} />}
        {activeTab === 'tenants' && <TenantTable tenants={filteredTenants} vacateRequests={safeVacateRequests} onCollect={(tenant) => { setSelectedTenant(tenant); setPaymentAmount(Number(tenant.pending_amount || tenant.rent_amount || 0)); setCollectionRequestId(crypto.randomUUID()); setShowPaymentModal(true) }} onHistory={fetchTenantPayments} onProfile={fetchTenantApplication} onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }} onConfirmPayment={openPaymentConfirmation} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
        {activeTab === 'archived-tenants' && <ArchivedTenantList tenants={filteredArchivedTenants} onViewHistory={fetchArchivedTenantHistory} loadingId={loadingArchivedTenantId} />}
        {activeTab === 'rent-payments' && <RentPaymentsList payments={filteredPendingPayments} onConfirm={(id) => handleReviewRentPayment(id, true)} onReject={(id) => handleReviewRentPayment(id, false)} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={isSubmitting} />}
        {activeTab === 'payment-history' && <PaymentHistoryTable payments={filteredAllPayments} getRoomNumberById={getRoomNumberById} onViewScreenshot={openSignedPaymentScreenshot} />}
        {activeTab === 'pre-bookings' && <PreBookingList bookings={filteredPreBookings} onApprove={(id, data) => approvePreBooking(id, data)} onReject={rejectPreBooking} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={Boolean(prebookingProcessingId)} />}
        {activeTab === 'applications' && <ApplicationList applications={filteredApplications} onApprove={(id, data) => approveApplication(id, data)} onReject={rejectApplication} onResendEmail={resendPasswordEmail} onViewScreenshot={openSignedPaymentScreenshot} isSubmitting={Boolean(applicationProcessingId)} />}
        {activeTab === 'existing-imports' && <div className="space-y-5"><ExistingTenantImportSettings link={existingImports.link} property={property} busy={existingImports.linkBusy} onGenerate={existingImports.rotateLink} onToggle={existingImports.setLinkEnabled} /><ExistingTenantImportList imports={filteredExistingImports} loading={existingImports.loading} total={existingImports.total} page={existingImports.page} pageSize={existingImports.pageSize} processingId={existingImports.processingId} onApprove={existingImports.approve} onReject={existingImports.reject} onPage={existingImports.loadPage} /></div>}
        {activeTab === 'complaints' && <ComplaintList complaints={filteredComplaints} onRespond={(complaint) => { setSelectedComplaint(complaint); setComplaintResponse(''); setShowComplaintResponseModal(true) }} onResolve={handleResolveComplaint} isSubmitting={isSubmitting} />}
        {activeTab === 'vacate' && <VacateRequestList requests={filteredVacateRequests} onApprove={handleApproveVacate} onReject={(request) => { setSelectedVacateRequest(request); setVacateRejectionReason(''); }} isSubmitting={isSubmitting || Boolean(vacateRejectingId)} />}
        {activeTab === 'room-change' && <RoomChangeRequestList requests={filteredRoomChangeRequests} onApprove={handleApproveRoomChange} onReject={(request) => { setSelectedRoomChangeRequest(request); setRejectionReason(''); setShowRoomChangeReasonModal(true) }} isSubmitting={isSubmitting} />}
        {activeTab === 'notices' && <NoticeList notices={filteredNotices} onDelete={deleteNotice} onPost={() => setShowNoticeModal(true)} isSubmitting={isSubmitting} />}
        </div>
      </main>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showPaymentModal && selectedTenant && <CollectRentModal key="collect-rent-modal" tenant={selectedTenant} paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount} onCollect={handleCollectRent} onCancel={() => { if (!isSubmitting) { setShowPaymentModal(false); setSelectedTenant(null); setPaymentAmount(''); setCollectionRequestId(null); } }} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} />}
        {showConfirmDeleteModal && tenantToDelete && <ConfirmDeleteModal key="confirm-delete-modal" tenant={tenantToDelete} onArchive={handleArchiveTenant} onCancel={() => { if (!isSubmitting) { setShowConfirmDeleteModal(false); setTenantToDelete(null); } }} isSubmitting={isSubmitting} />}
        {showSettingsModal && <SettingsModal key="settings-modal" settings={settings} setSettings={setSettings} property={property} onSave={handleSaveSettings} onCancel={() => setShowSettingsModal(false)} isSubmitting={isSubmitting} />}
        {showAddModal && <AddTenantModal key="add-tenant-modal" formData={formData} setFormData={setFormData} rooms={rooms} onAdd={() => addTenant(isSubmitting, setIsSubmitting)} onCancel={() => setShowAddModal(false)} isSubmitting={isSubmitting} />}
        {showRoomModal && <AddRoomModal key="add-room-modal" roomForm={roomForm} setRoomForm={setRoomForm} sharingTypes={sharingTypes} onAdd={() => addRoom(isSubmitting, setIsSubmitting)} onCancel={() => setShowRoomModal(false)} isSubmitting={isSubmitting} />}
        {showNoticeModal && <PostNoticeModal key="post-notice-modal" noticeForm={noticeForm} setNoticeForm={setNoticeForm} onPost={handlePostNotice} onCancel={() => { if (!isSubmitting) setShowNoticeModal(false); }} isSubmitting={isSubmitting} />}
        {showMembershipModal && <MembershipModal key="membership-modal" onSelectPlan={async (...args) => { const sent = await requestMembership(...args); if (sent) setShowMembershipModal(false); }} onCancel={() => setShowMembershipModal(false)} loading={membershipLoading} pendingRequest={pendingMembershipRequest} />}
        {showOwnerProfileModal && ownerProfile && <OwnerProfileModal key="owner-profile-modal" profile={ownerProfile} onSave={handleSaveOwnerProfile} onCancel={() => setShowOwnerProfileModal(false)} isSubmitting={isSubmitting} />}
        {showArchivedHistoryModal && <ArchivedTenantHistoryModal key="archived-history-modal" history={archivedHistory} loading={Boolean(loadingArchivedTenantId)} onClose={() => { setShowArchivedHistoryModal(false); setArchivedHistory(null); }} />}
        {showComplaintResponseModal && selectedComplaint && <ComplaintResponseModal key="complaint-response-modal" complaint={selectedComplaint} response={complaintResponse} setResponse={setComplaintResponse} onSend={handleRespondToComplaint} onCancel={() => { setShowComplaintResponseModal(false); setSelectedComplaint(null); setComplaintResponse(''); }} isSubmitting={isSubmitting} />}
        {showRoomChangeReasonModal && selectedRoomChangeRequest && <RoomChangeReasonModal key="room-change-reason-modal" reason={rejectionReason} setReason={setRejectionReason} onReject={handleRejectRoomChange} onCancel={() => { setShowRoomChangeReasonModal(false); setSelectedRoomChangeRequest(null); setRejectionReason(''); }} isSubmitting={isSubmitting} />}
        {selectedVacateRequest && <VacateRejectionModal key="vacate-rejection-modal" request={selectedVacateRequest} reason={vacateRejectionReason} setReason={setVacateRejectionReason} onReject={async () => { const rejected = await rejectVacateRequest(selectedVacateRequest.id, vacateRejectionReason); if (rejected) { setSelectedVacateRequest(null); setVacateRejectionReason(''); } }} onCancel={() => { if (!vacateRejectingId) { setSelectedVacateRequest(null); setVacateRejectionReason(''); } }} isSubmitting={Boolean(vacateRejectingId)} />}
        {showPaymentConfirmModal && confirmingTenant && <PaymentConfirmModal key="payment-confirm-modal" tenant={confirmingTenant} onConfirm={handleConfirmPendingPayment} onCancel={() => { if (!isSubmitting) { setShowPaymentConfirmModal(false); setConfirmingTenant(null); } }} isSubmitting={isSubmitting} onViewScreenshot={openSignedPaymentScreenshot} />}
        {showRoomDetailsModal && selectedRoom && <div key="room-details-modal" className="hidden lg:block"><RoomDetailsModal room={selectedRoom} tenantsInRoom={getTenantsInRoom(selectedRoom.id)} onClose={() => setShowRoomDetailsModal(false)} isSubmitting={isSubmitting} getRoomNumberById={getRoomNumberById} onUpdated={async (updated) => { setRooms(current => current.map(room => room.id === updated.id ? updated : room)); setSelectedRoom(updated); await loadData(true); }} /></div>}
        
        {/* History Modal */}
        {showTenantPaymentsModal && selectedTenantForPayments && (
          <TenantPaymentsModal
            key="tenant-payments-modal"
            tenant={selectedTenantForPayments}
            payments={tenantPayments}
            loading={loadingPayments}
            onClose={() => setShowTenantPaymentsModal(false)}
            onViewScreenshot={openSignedPaymentScreenshot}
          />
        )}

        {/* Profile Modal */}
        {showTenantProfileModal && selectedProfileTenant && (
          <TenantProfileModal
            key="tenant-profile-modal"
            tenant={selectedProfileTenant}
            application={tenantApplication}
            extraDocuments={tenantExtraDocuments}
            loading={loadingProfile}
            onClose={() => { setShowTenantProfileModal(false); setTenantExtraDocuments([]) }}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}
        {showScreenshotModal && (
          <ScreenshotModal key="screenshot-modal" url={screenshotUrl} onClose={() => { setShowScreenshotModal(false); setScreenshotUrl(''); }} />
        )}
      </AnimatePresence>
    </div>
  )
}
