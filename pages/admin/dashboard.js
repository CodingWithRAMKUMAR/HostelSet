import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { formatCurrency, formatDate } from '../../lib/utils'
import { useAdminDashboard } from '../../hooks/useAdminDashboard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

// Content Components (static)
import AdminStatsCards from '../../components/admin/AdminStatsCards'
import RevenueChart from '../../components/admin/RevenueChart'
import OccupancyChart from '../../components/admin/OccupancyChart'
import QuickAlerts from '../../components/admin/QuickAlerts'
import PropertiesTable from '../../components/admin/PropertiesTable'
import TenantsTable from '../../components/admin/TenantsTable'
import PaymentsTable from '../../components/admin/PaymentsTable'
import RoomsTable from '../../components/admin/RoomsTable'
import PreBookingsList from '../../components/admin/PreBookingsList'
import ApplicationsList from '../../components/admin/ApplicationsList'
import ApprovedApplicationsList from '../../components/admin/ApprovedApplicationsList'
import ComplaintsList from '../../components/admin/ComplaintsList'
import VacateList from '../../components/admin/VacateList'
import RoomChangeRequestsList from '../../components/admin/RoomChangeRequestsList'
import NoticesList from '../../components/admin/NoticesList'
import UsersTable from '../../components/admin/UsersTable'
import OwnerSettingsTable from '../../components/admin/OwnerSettingsTable'
import SystemSettingsForm from '../../components/admin/SystemSettingsForm'
import MembershipPlansList from '../../components/admin/MembershipPlansList'
import AuditLogsTable from '../../components/admin/AuditLogsTable'

// Modal Components (lazy‑loaded)
const GrantMembershipModal = dynamic(() => import('../../components/admin/modals/GrantMembershipModal'), { ssr: false })
const RejectReasonModal = dynamic(() => import('../../components/admin/modals/RejectReasonModal'), { ssr: false })
const EditPlanModal = dynamic(() => import('../../components/admin/modals/EditPlanModal'), { ssr: false })
const EditOwnerSettingsModal = dynamic(() => import('../../components/admin/modals/EditOwnerSettingsModal'), { ssr: false })
const DeleteConfirmModal = dynamic(() => import('../../components/admin/modals/DeleteConfirmModal'), { ssr: false })

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function AdminDashboard() {
  const router = useRouter()
  const {
    loading,
    properties,
    tenants,
    payments,
    complaints,
    vacateRequests,
    applications,
    approvedApplications,
    rooms,
    preBookings,
    notices,
    users,
    ownerSettings,
    membershipPlans,
    systemSettings,
    setSystemSettings,
    auditLogs,
    roomChangeRequests,
    stats,
    revenueData,
    occupancyData,
    activeTab,
    setActiveTab,
    grantModal,
    setGrantModal,
    grantDuration,
    setGrantDuration,
    grantSubmitting,
    selectedProperties,
    setSelectedProperties,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    editPlanModal,
    setEditPlanModal,
    editSettingsModal,
    setEditSettingsModal,
    editOwnerSettingsModal,
    setEditOwnerSettingsModal,
    deleteConfirmModal,
    setDeleteConfirmModal,
    rejectReasonModal,
    setRejectReasonModal,
    rejectionReason,
    setRejectionReason,
    loadAllData,
    getDaysUntilVacate,
    handleMembershipAction,
    bulkMembershipAction,
    approveRoomChange,
    rejectRoomChange,
    approvePreBooking,
    rejectPreBooking,
    approveApplication,
    rejectApplication,
    deleteProperty,
    deleteUser,
    updateUserRole,
    postNotice,
    deleteNotice,
    updateSystemSettings,
    updateOwnerSettings,
    updateMembershipPlan,
    filteredProperties,
    filteredTenants,
    filteredPayments,
    paginate,
  } = useAdminDashboard()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const expiringMemberships = properties.filter(p => {
    if (!p.membership_expiry) return false
    const daysLeft = Math.ceil((new Date(p.membership_expiry) - new Date()) / (1000 * 60 * 60 * 24))
    return daysLeft <= 7 && daysLeft >= 0
  })

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🛡️ Admin Dashboard</h1>
        <div className="flex gap-4 items-center">
          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-bold">Admin</span>
          <button onClick={() => router.push('/')} className="text-purple-400 hover:text-purple-300">View Site</button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Alerts */}
        <QuickAlerts stats={stats} expiringMemberships={expiringMemberships} />

        {/* Stats Cards */}
        <AdminStatsCards stats={stats} />

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <RevenueChart data={revenueData} />
          <OccupancyChart data={occupancyData} colors={COLORS} />
        </div>

        {/* Search & Bulk */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Search..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {activeTab === 'properties' && (
            <div className="flex gap-2">
              <button onClick={() => bulkMembershipAction('grant', 30)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Grant (30d)</button>
              <button onClick={() => bulkMembershipAction('revoke')} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Revoke</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
          {['overview', 'properties', 'tenants', 'payments', 'rooms', 'prebookings', 'applications', 'approved-applications', 'complaints', 'vacate', 'room-changes', 'notices', 'users', 'owner-settings', 'system-settings', 'membership-plans', 'audit-logs'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); setSearchTerm(''); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* ========== TAB CONTENT ========== */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4">⚡ Recent Activity</h2>
              <div className="space-y-3 text-gray-300">
                {stats.pendingMemberships > 0 && <p className="text-yellow-400">⭐ {stats.pendingMemberships} owners need membership</p>}
                {stats.pendingPayments > 0 && <p className="text-red-400">💰 {stats.pendingPayments} pending payment confirmations</p>}
                {stats.pendingApplications > 0 && <p className="text-blue-400">📋 {stats.pendingApplications} new applications</p>}
                {stats.unresolvedComplaints > 0 && <p className="text-orange-400">🔧 {stats.unresolvedComplaints} open complaints</p>}
                {stats.pendingRoomChanges > 0 && <p className="text-purple-400">🔄 {stats.pendingRoomChanges} room change requests</p>}
              </div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4">📌 Quick Actions</h2>
              <div className="space-y-2 text-gray-300">
                <p>• <strong>Properties</strong> – grant/revoke memberships (bulk available)</p>
                <p>• <strong>Room Changes</strong> – approve/reject tenant requests</p>
                <p>• <strong>Pre‑bookings</strong> – approve/reject directly</p>
                <p>• <strong>Applications</strong> – approve/reject with reason</p>
                <p>• <strong>Vacate</strong> – view days left and status</p>
                <p>• <strong>Users</strong> – change roles, delete</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <PropertiesTable
            properties={filteredProperties}
            selectedProperties={selectedProperties}
            setSelectedProperties={setSelectedProperties}
            paginate={paginate}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={10}
            totalItems={filteredProperties.length}
            onGrant={(ownerId, ownerName) => setGrantModal({ show: true, ownerId, ownerName })}
            onRevoke={(ownerId) => handleMembershipAction(ownerId, 'revoke')}
            onDelete={(id, name) => setDeleteConfirmModal({ show: true, type: 'property', id, name })}
          />
        )}

        {activeTab === 'tenants' && (
          <TenantsTable
            tenants={filteredTenants}
            paginate={paginate}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={10}
            totalItems={filteredTenants.length}
          />
        )}

        {activeTab === 'payments' && (
          <PaymentsTable
            payments={filteredPayments}
            paginate={paginate}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={10}
            totalItems={filteredPayments.length}
          />
        )}

        {activeTab === 'rooms' && (
          <RoomsTable rooms={rooms} onDelete={(id, name) => setDeleteConfirmModal({ show: true, type: 'room', id, name })} />
        )}

        {activeTab === 'prebookings' && (
          <PreBookingsList
            bookings={preBookings}
            onApprove={approvePreBooking}
            onReject={rejectPreBooking}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsList
            applications={applications}
            onApprove={approveApplication}
            onReject={(id) => { setRejectReasonModal({ show: true, requestId: id, type: 'application' }); setRejectionReason(''); }}
          />
        )}

        {activeTab === 'approved-applications' && (
          <ApprovedApplicationsList applications={approvedApplications} />
        )}

        {activeTab === 'complaints' && (
          <ComplaintsList complaints={complaints} onDelete={() => { /* handled internally */ }} loadAllData={loadAllData} />
        )}

        {activeTab === 'vacate' && (
          <VacateList vacateRequests={vacateRequests} getDaysUntilVacate={getDaysUntilVacate} />
        )}

        {activeTab === 'room-changes' && (
          <RoomChangeRequestsList
            requests={roomChangeRequests}
            onApprove={approveRoomChange}
            onReject={(id) => { setRejectReasonModal({ show: true, requestId: id, type: 'roomchange' }); setRejectionReason(''); }}
          />
        )}

        {activeTab === 'notices' && (
          <NoticesList notices={notices} onPost={postNotice} onDelete={deleteNotice} />
        )}

        {activeTab === 'users' && (
          <UsersTable
            users={users}
            onRoleChange={updateUserRole}
            onDelete={(id, name) => setDeleteConfirmModal({ show: true, type: 'user', id, name })}
          />
        )}

        {activeTab === 'owner-settings' && (
          <OwnerSettingsTable
            settings={ownerSettings}
            onEdit={(settings) => setEditOwnerSettingsModal({ show: true, settings })}
          />
        )}

        {activeTab === 'system-settings' && (
          <SystemSettingsForm
            settings={systemSettings}
            setSettings={setSystemSettings}
            onSave={updateSystemSettings}
          />
        )}

        {activeTab === 'membership-plans' && (
          <MembershipPlansList plans={membershipPlans} onEdit={(plan) => setEditPlanModal({ show: true, plan })} />
        )}

        {activeTab === 'audit-logs' && (
          <AuditLogsTable logs={auditLogs} />
        )}
      </div>

      {/* ========== MODALS ========== */}
      <AnimatePresence>
        {grantModal.show && (
          <GrantMembershipModal
            ownerName={grantModal.ownerName}
            grantDuration={grantDuration}
            setGrantDuration={setGrantDuration}
            onGrant={() => handleMembershipAction(grantModal.ownerId, 'grant', grantDuration)}
            onCancel={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })}
            isSubmitting={grantSubmitting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectReasonModal.show && (
          <RejectReasonModal
            reason={rejectionReason}
            setReason={setRejectionReason}
            onConfirm={() => {
              if (rejectReasonModal.type === 'application') rejectApplication(rejectReasonModal.requestId)
              else if (rejectReasonModal.type === 'roomchange') rejectRoomChange(rejectReasonModal.requestId)
            }}
            onCancel={() => setRejectReasonModal({ show: false, requestId: null, type: '' })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editPlanModal.show && editPlanModal.plan && (
          <EditPlanModal
            plan={editPlanModal.plan}
            onSave={updateMembershipPlan}
            onCancel={() => setEditPlanModal({ show: false, plan: null })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editOwnerSettingsModal.show && editOwnerSettingsModal.settings && (
          <EditOwnerSettingsModal
            settings={editOwnerSettingsModal.settings}
            onSave={updateOwnerSettings}
            onCancel={() => setEditOwnerSettingsModal({ show: false, settings: null })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmModal.show && (
          <DeleteConfirmModal
            type={deleteConfirmModal.type}
            name={deleteConfirmModal.name}
            onConfirm={() => {
              if (deleteConfirmModal.type === 'property') deleteProperty(deleteConfirmModal.id)
              else if (deleteConfirmModal.type === 'user') deleteUser(deleteConfirmModal.id)
              else setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
            }}
            onCancel={() => setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
