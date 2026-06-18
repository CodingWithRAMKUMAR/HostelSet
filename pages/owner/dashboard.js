import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { useOwnerDashboard } from '../../hooks/useOwnerDashboard'
import { formatCurrency, formatDate } from '../../lib/utils'

// Content Components (static – always needed)
import StatsCards from '../../components/owner/StatsCards'
import RoomList from '../../components/owner/RoomList'
import TenantTable from '../../components/owner/TenantTable'
import RentPaymentsList from '../../components/owner/RentPaymentsList'
import PaymentHistoryTable from '../../components/owner/PaymentHistoryTable'
import PreBookingList from '../../components/owner/PreBookingList'
import ComplaintList from '../../components/owner/ComplaintList'
import VacateRequestList from '../../components/owner/VacateRequestList'
import NoticeList from '../../components/owner/NoticeList'
import ApplicationList from '../../components/owner/ApplicationList'
import RoomChangeRequestList from '../../components/owner/RoomChangeRequestList'

// Modal Components (lazy‑loaded)
const ConfirmDeleteModal = dynamic(() => import('../../components/owner/modals/ConfirmDeleteModal'), { ssr: false })
const AddTenantModal = dynamic(() => import('../../components/owner/modals/AddTenantModal'), { ssr: false })
const AddRoomModal = dynamic(() => import('../../components/owner/modals/AddRoomModal'), { ssr: false })
const CollectRentModal = dynamic(() => import('../../components/owner/modals/CollectRentModal'), { ssr: false })
const PostNoticeModal = dynamic(() => import('../../components/owner/modals/PostNoticeModal'), { ssr: false })
const SettingsModal = dynamic(() => import('../../components/owner/modals/SettingsModal'), { ssr: false })
const ComplaintResponseModal = dynamic(() => import('../../components/owner/modals/ComplaintResponseModal'), { ssr: false })
const RoomDetailsModal = dynamic(() => import('../../components/owner/modals/RoomDetailsModal'), { ssr: false })
const MembershipModal = dynamic(() => import('../../components/owner/modals/MembershipModal'), { ssr: false })
const PaymentConfirmModal = dynamic(() => import('../../components/owner/modals/PaymentConfirmModal'), { ssr: false })
const ApplicationDetailModal = dynamic(() => import('../../components/owner/modals/ApplicationDetailModal'), { ssr: false })
const TenantPaymentsModal = dynamic(() => import('../../components/owner/modals/TenantPaymentsModal'), { ssr: false })
const TenantProfileModal = dynamic(() => import('../../components/owner/modals/TenantProfileModal'), { ssr: false })
const RoomChangeReasonModal = dynamic(() => import('../../components/owner/modals/RoomChangeReasonModal'), { ssr: false })
const ScreenshotModal = dynamic(() => import('../../components/owner/modals/ScreenshotModal'), { ssr: false })

export default function OwnerDashboard() {
  const router = useRouter()
  const {
    loading, property, rooms, tenants, applications, vacateRequests,
    complaints, notices, stats, alerts, activeTab, setActiveTab,
    membershipActive, membershipExpiry, daysLeft, pendingRentPayments,
    allPayments, preBookings, roomChangeRequests, isSubmitting,
    showAddModal, setShowAddModal,
    showRoomModal, setShowRoomModal,
    showPaymentModal, setShowPaymentModal,
    showNoticeModal, setShowNoticeModal,
    showRoomDetailsModal, setShowRoomDetailsModal,
    showSettingsModal, setShowSettingsModal,
    showComplaintResponseModal, setShowComplaintResponseModal,
    showConfirmDeleteModal, setShowConfirmDeleteModal,
    showMembershipModal, setShowMembershipModal,
    showPaymentConfirmModal, setShowPaymentConfirmModal,
    showApplicationDetailModal, setShowApplicationDetailModal,
    showTenantPaymentsModal, setShowTenantPaymentsModal,
    showScreenshotModal, setShowScreenshotModal,
    showTenantProfileModal, setShowTenantProfileModal,
    showRoomChangeReasonModal, setShowRoomChangeReasonModal,
    selectedRoom, setSelectedRoom,
    selectedTenant, setSelectedTenant,
    selectedComplaint, setSelectedComplaint,
    selectedApplication, setSelectedApplication,
    selectedTenantForPayments, setSelectedTenantForPayments,
    selectedProfileTenant, setSelectedProfileTenant,
    selectedRoomChangeRequest, setSelectedRoomChangeRequest,
    confirmingTenant, setConfirmingTenant,
    tenantToDelete, setTenantToDelete,
    complaintResponse, setComplaintResponse,
    rejectionReason, setRejectionReason,
    screenshotUrl, setScreenshotUrl,
    tenantPayments, tenantApplication, loadingProfile,
    searchTerm, setSearchTerm,
    getRoomNumberById, getTenantsInRoom, calculateRentDueStatus,
    addTenant, addRoom, deleteRoom, deleteTenantComplete, deleteTenantSoft,
    collectRent, confirmRentPayment, rejectRentPayment, confirmPayment,
    respondToComplaint, resolveComplaint, approveVacateRequest,
    postNotice, deleteNotice, approvePreBooking, rejectPreBooking,
    approveRoomChange, rejectRoomChange,
    fetchTenantPayments, fetchTenantApplication,
    approveApplication, resendPasswordEmail,
    initiateMembershipPayment,
    saveSettings, handleAlertClick, removeAlert,
    forceDeleteOverdueVacateTenants, autoDeleteExpiredNoticeTenants, loadData,
    sharingTypes, roomForm, setRoomForm, noticeForm, setNoticeForm,
    formData, setFormData, paymentAmount, setPaymentAmount,
    settings, setSettings,   // ✅ setSettings is now destructured
    roomMonthlyIncome, membershipLoading,
  } = useOwnerDashboard()

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

  const safeRooms = rooms || []
  const safeTenants = tenants || []
  const safeAllPayments = allPayments || []
  const safeApplications = applications || []
  const safeComplaints = complaints || []
  const safeVacateRequests = vacateRequests || []
  const safePreBookings = preBookings || []
  const safeNotices = notices || []
  const safeRoomChangeRequests = roomChangeRequests || []

  const filteredTenants = safeTenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.room_number && t.room_number.toString().includes(searchTerm))
  )

  const filteredPayments = safeAllPayments.filter(p =>
    p.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.tenants?.rooms?.room_number && p.tenants.rooms.room_number.toString().includes(searchTerm))
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Subscription Banner & Alerts */}
      {!membershipActive && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3 text-center sticky top-0 z-50">
          <p className="text-yellow-800 font-semibold">
            ⭐ You're exploring the dashboard with limited access. 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline text-yellow-900 font-bold hover:text-yellow-950">
              Subscribe now
            </button> to unlock all features.
          </p>
        </div>
      )}

      {membershipActive && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3 text-center">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Your membership will expire in {daysLeft} day{daysLeft !== 1 ? 's' : ''} on {formatDate(membershipExpiry)}. 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline font-bold">Renew now</button>
          </p>
        </div>
      )}
      {membershipActive && daysLeft !== null && daysLeft <= 0 && (
        <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center">
          <p className="text-red-800 font-semibold">
            ❌ Your membership has expired! 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline font-bold">Renew now</button>
          </p>
        </div>
      )}

      {stats.pendingPaymentCount > 0 && (
        <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center">
          <p className="text-red-800 font-semibold">
            ⚠️ You have {stats.pendingPaymentCount} pending payment{stats.pendingPaymentCount > 1 ? 's' : ''}. 
            <button onClick={() => setActiveTab('tenants')} className="ml-2 underline text-red-900 font-bold">Review now</button>
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
          <div className="container mx-auto">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">🔔 Notifications</h3>
            <div className="space-y-1">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 cursor-pointer transition"
                  onClick={() => handleAlertClick(alert)}
                >
                  <span className="text-sm">{alert.message}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAlert(alert.id); }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="text"
              placeholder="🔍 Search by name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              onClick={() => setShowMembershipModal(true)}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                membershipActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {membershipActive ? '✅ Active' : '⭐ Buy Membership'}
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-gray-500 hover:text-slate-800 transition px-3 py-1 rounded-lg hover:bg-gray-100"
            >
              ⚙️ Settings
            </button>
            <span className="text-sm hidden md:inline text-gray-500">{property.name}</span>
            <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/') }} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <StatsCards stats={stats} />

        {activeTab === 'overview' && (
          <div>
            {stats.pendingRentConfirmations > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
                <p className="font-semibold text-red-800">💸 {stats.pendingRentConfirmations} rent payment(s) awaiting confirmation. <button onClick={() => setActiveTab('rent-payments')} className="underline">Review</button></p>
              </div>
            )}
            {stats.pendingPaymentCount > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
                <p className="font-semibold text-red-800">⚠️ {stats.pendingPaymentCount} tenant(s) awaiting payment confirmation. <button onClick={() => setActiveTab('tenants')} className="underline">Review</button></p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
              <h3 className="font-semibold text-slate-800 mb-4">📅 Due Today</h3>
              {tenants.filter(t => calculateRentDueStatus(t).daysUntilDue === 0).length === 0 ? (
                <p className="text-gray-500">No tenants due today.</p>
              ) : (
                <div className="space-y-3">
                  {tenants.filter(t => calculateRentDueStatus(t).daysUntilDue === 0).map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-700">{t.name}</p>
                        <p className="text-xs text-gray-400">Room {t.room_number || getRoomNumberById(t.room_id)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-600">Due: {formatCurrency(t.pending_amount || t.rent_amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => membershipActive && setShowAddModal(true)}
            disabled={!membershipActive}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'bg-slate-800 text-white hover:bg-slate-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            + Add Tenant
          </button>
          <button
            onClick={() => membershipActive && setShowRoomModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            + Add Room
          </button>
          <button
            onClick={() => membershipActive && setShowNoticeModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            📢 Post Notice
          </button>
          <button
            onClick={() => membershipActive && setShowSettingsModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-blue-300 text-blue-700 hover:bg-blue-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'rooms', 'tenants', 'rent-payments', 'payment-history', 'pre-bookings', 'complaints', 'vacate', 'room-change', 'applications', 'notices'].map((tab) => {
            const pendingPreBookings = preBookings.filter(b => b.status === 'pending' && b.payment_status === 'pending')
            return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              disabled={!membershipActive}
              className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${
                activeTab === tab 
                  ? 'bg-slate-800 text-white' 
                  : membershipActive 
                    ? 'text-gray-500 hover:text-slate-700 hover:bg-gray-50' 
                    : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {tab === 'rent-payments' && `💸 Rent Payments (${stats.pendingRentConfirmations})`}
              {tab === 'payment-history' && '💳 Payment History'}
              {tab === 'pre-bookings' && `📋 Pre‑bookings (${pendingPreBookings.length})`}
              {tab === 'overview' && '📊 Overview'}
              {tab === 'rooms' && `🏠 Rooms (${rooms.length})`}
              {tab === 'tenants' && `👥 Tenants (${tenants.length})`}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints > 0 ? `(${stats.totalComplaints})` : ''}`}
              {tab === 'vacate' && `🚪 Vacate ${stats.pendingVacate > 0 ? `(${stats.pendingVacate})` : ''}`}
              {tab === 'room-change' && `🔄 Room Change (${roomChangeRequests.length})`}
              {tab === 'applications' && `📋 Applications ${applications.length > 0 ? `(${applications.length})` : ''}`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
            </button>
          )})}
        </div>

        {/* Tab Content */}
        {activeTab === 'rooms' && (
          <RoomList
            rooms={safeRooms}
            tenants={safeTenants}
            vacateRequests={safeVacateRequests}
            roomMonthlyIncome={roomMonthlyIncome}
            onRoomClick={(room) => { setSelectedRoom(room); setShowRoomDetailsModal(true) }}
            onDeleteRoom={deleteRoom}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'tenants' && (
          <TenantTable
            tenants={filteredTenants}
            vacateRequests={safeVacateRequests}
            onCollect={(tenant) => { setSelectedTenant(tenant); setShowPaymentModal(true) }}
            onHistory={fetchTenantPayments}
            onProfile={fetchTenantApplication}
            onDelete={(tenant) => { setTenantToDelete(tenant); setShowConfirmDeleteModal(true) }}
            onConfirmPayment={(tenant) => { setConfirmingTenant(tenant); setShowPaymentConfirmModal(true) }}
            isSubmitting={isSubmitting}
            getRoomNumberById={getRoomNumberById}
            calculateRentDueStatus={calculateRentDueStatus}
          />
        )}

        {activeTab === 'rent-payments' && (
          <RentPaymentsList
            payments={pendingRentPayments}
            onConfirm={confirmRentPayment}
            onReject={rejectRentPayment}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'payment-history' && (
          <PaymentHistoryTable
            payments={filteredPayments}
            getRoomNumberById={getRoomNumberById}
          />
        )}

        {activeTab === 'pre-bookings' && (
          <PreBookingList
            bookings={safePreBookings}
            onApprove={approvePreBooking}
            onReject={rejectPreBooking}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'complaints' && (
          <ComplaintList
            complaints={safeComplaints}
            onRespond={(complaint) => { setSelectedComplaint(complaint); setShowComplaintResponseModal(true) }}
            onResolve={resolveComplaint}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'vacate' && (
          <VacateRequestList
            requests={safeVacateRequests}
            onApprove={approveVacateRequest}
            onCleanup={async () => {
              await forceDeleteOverdueVacateTenants()
              await autoDeleteExpiredNoticeTenants()
              toast.success('Cleanup complete. Dashboard will refresh.')
              loadData()
            }}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'room-change' && (
          <RoomChangeRequestList
            requests={safeRoomChangeRequests}
            onApprove={approveRoomChange}
            onReject={(request) => {
              setSelectedRoomChangeRequest(request)
              setRejectionReason('')
              setShowRoomChangeReasonModal(true)
            }}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationList
            applications={safeApplications}
            onApprove={approveApplication}
            onResendEmail={resendPasswordEmail}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'notices' && (
          <NoticeList
            notices={safeNotices}
            onDelete={deleteNotice}
            onPost={() => setShowNoticeModal(true)}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showConfirmDeleteModal && tenantToDelete && (
          <ConfirmDeleteModal
            tenant={tenantToDelete}
            onDeleteComplete={() => deleteTenantComplete(tenantToDelete.id, tenantToDelete.room_id, tenantToDelete.user_id)}
            onDeleteSoft={() => deleteTenantSoft(tenantToDelete.id, tenantToDelete.room_id)}
            onCancel={() => setShowConfirmDeleteModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <AddTenantModal
            formData={formData}
            setFormData={setFormData}
            rooms={rooms}
            onAdd={addTenant}
            onCancel={() => setShowAddModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoomModal && (
          <AddRoomModal
            roomForm={roomForm}
            setRoomForm={setRoomForm}
            sharingTypes={sharingTypes}
            onAdd={addRoom}
            onCancel={() => setShowRoomModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && selectedTenant && (
          <CollectRentModal
            tenant={selectedTenant}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            onCollect={collectRent}
            onCancel={() => setShowPaymentModal(false)}
            isSubmitting={isSubmitting}
            getRoomNumberById={getRoomNumberById}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNoticeModal && (
          <PostNoticeModal
            noticeForm={noticeForm}
            setNoticeForm={setNoticeForm}
            onPost={postNotice}
            onCancel={() => setShowNoticeModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && (
          <SettingsModal
            settings={settings}
            setSettings={setSettings}   // ✅ setSettings passed correctly
            onSave={saveSettings}
            onCancel={() => setShowSettingsModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComplaintResponseModal && selectedComplaint && (
          <ComplaintResponseModal
            complaint={selectedComplaint}
            response={complaintResponse}
            setResponse={setComplaintResponse}
            onSend={respondToComplaint}
            onCancel={() => setShowComplaintResponseModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRoomDetailsModal && selectedRoom && (
          <RoomDetailsModal
            room={selectedRoom}
            tenantsInRoom={getTenantsInRoom(selectedRoom.id)}
            onClose={() => setShowRoomDetailsModal(false)}
            onHistory={fetchTenantPayments}
            onProfile={fetchTenantApplication}
            isSubmitting={isSubmitting}
            getRoomNumberById={getRoomNumberById}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMembershipModal && (
          <MembershipModal
            onSelectPlan={initiateMembershipPayment}
            onCancel={() => setShowMembershipModal(false)}
            loading={membershipLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentConfirmModal && confirmingTenant && (
          <PaymentConfirmModal
            tenant={confirmingTenant}
            onConfirm={() => confirmPayment(confirmingTenant.id)}
            onCancel={() => setShowPaymentConfirmModal(false)}
            isSubmitting={isSubmitting}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showApplicationDetailModal && selectedApplication && (
          <ApplicationDetailModal
            application={selectedApplication}
            onApprove={() => approveApplication(selectedApplication.id)}
            onClose={() => setShowApplicationDetailModal(false)}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTenantPaymentsModal && selectedTenantForPayments && (
          <TenantPaymentsModal
            tenant={selectedTenantForPayments}
            payments={tenantPayments}
            onClose={() => setShowTenantPaymentsModal(false)}
            onViewScreenshot={(url) => { setScreenshotUrl(url); setShowScreenshotModal(true) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
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

      <AnimatePresence>
        {showRoomChangeReasonModal && selectedRoomChangeRequest && (
          <RoomChangeReasonModal
            reason={rejectionReason}
            setReason={setRejectionReason}
            onReject={rejectRoomChange}
            onCancel={() => setShowRoomChangeReasonModal(false)}
            isSubmitting={isSubmitting}
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
