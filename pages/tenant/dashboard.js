import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useTenantDashboard } from '../../hooks/useTenantDashboard'
import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils'

// Components
import PayRentModal from '../../components/tenant/modals/PayRentModal'
import ComplaintModal from '../../components/tenant/modals/ComplaintModal'
import VacateModal from '../../components/tenant/modals/VacateModal'
import ProfileModal from '../../components/tenant/modals/ProfileModal'
import RoomChangeModal from '../../components/tenant/modals/RoomChangeModal'
import ScreenshotModal from '../../components/tenant/modals/ScreenshotModal'

export default function TenantDashboard() {
  const {
    loading,
    tenant,
    room,
    property,
    owner,
    roommates,
    notices,
    complaints,
    paymentHistory,
    existingVacateRequest,
    roommateVacateAlert,
    showComplaintModal,
    setShowComplaintModal,
    showPaymentModal,
    setShowPaymentModal,
    showVacateModal,
    setShowVacateModal,
    showProfileModal,
    setShowProfileModal,
    complaintForm,
    setComplaintForm,
    vacateForm,
    setVacateForm,
    paymentAmount,
    setPaymentAmount,
    isSubmitting,
    activeTab,
    setActiveTab,
    editProfile,
    setEditProfile,
    profileForm,
    setProfileForm,
    ratingHover,
    setRatingHover,
    ownerUpiId,
    ownerUpiPhone,
    paymentScreenshot,
    setPaymentScreenshot,
    paymentTransactionId,
    setPaymentTransactionId,
    paymentLoading,
    showScreenshotModal,
    setShowScreenshotModal,
    screenshotUrl,
    setScreenshotUrl,
    showRoomChangeModal,
    setShowRoomChangeModal,
    availableRooms,
    selectedNewRoom,
    setSelectedNewRoom,
    roomChangeReason,
    setRoomChangeReason,
    pendingRoomChangeRequest,
    getRentStatus,
    initiateUPIPayment,
    copyUpiId,
    copyUpiPhone,
    refreshData,
    updateProfile,
    submitComplaint,
    deleteComplaint,
    requestVacate,
    cancelVacateRequest,
    submitPaymentWithProof,
    openRoomChangeModal,
    submitRoomChangeRequest,
    handleLogout,
  } = useTenantDashboard()

  const rentStatus = getRentStatus()
  const isUrgent = rentStatus.urgent && (rentStatus.status === 'due_soon' || rentStatus.status === 'overdue')

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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-6"><h3 className="font-semibold mb-4">🏠 Your Room Details</h3><div className="space-y-3"><div className="flex justify-between py-2 border-b"><span className="text-gray-500">Room Number:</span><span>{room?.room_number}</span></div><div className="flex justify-between py-2 border-b"><span>Sharing Type:</span><span>{getSharingDetails(room?.sharing_type)?.label}</span></div><div className="flex justify-between py-2 border-b"><span>Monthly Rent:</span><span className="text-green-600 font-semibold">{formatCurrency(room?.monthly_rent)}</span></div><div className="flex justify-between py-2 border-b"><span>Move-in Date:</span><span>{formatDate(tenant?.move_in_date)}</span></div><div className="flex justify-between py-2 border-b"><span>Status:</span><span className={`px-2 py-1 rounded-full text-xs ${tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tenant?.status === 'active' ? 'Active' : 'Notice Period'}</span></div>{pendingRoomChangeRequest && (<div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">⏳ Room change request pending approval to Room {pendingRoomChangeRequest.new_room_id}.</div>)}</div></div>
            <div className="bg-white rounded-xl border p-6"><h3 className="font-semibold mb-4">🏢 Property Information</h3><div className="space-y-3"><div className="flex justify-between py-2 border-b"><span className="text-gray-500">Property Name:</span><span>{property?.name}</span></div><div className="flex justify-between py-2 border-b"><span>Address:</span><span className="text-right">{property?.address}, {property?.city}</span></div><div className="flex justify-between py-2 border-b"><span>Owner Name:</span><span>{owner?.full_name || 'Not provided'}</span></div><div className="flex justify-between py-2 border-b"><span>Owner Contact:</span><span className="font-medium">{property?.contact_number || owner?.phone || 'Not provided'}</span></div></div></div>
          </div>
        )}

        {/* Roommates Tab */}
        {activeTab === 'roommates' && (
          <div className="bg-white rounded-xl border p-6"><h3 className="font-semibold mb-4">👥 Your Roommates <span className="text-xs text-gray-400 ml-2">(Same Room Only)</span></h3>
            {roommates.length > 0 ? <div className="grid md:grid-cols-2 gap-4">{roommates.map((mate, idx) => (<div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"><div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-lg font-bold">{mate.name.charAt(0)}</div><div><p className="font-semibold">{mate.name}</p><p className="text-xs text-gray-500">📞 {mate.phone}</p><p className="text-xs text-gray-400">Since {formatDate(mate.move_in_date)}</p></div></div>))}</div> : <div className="text-center py-12"><div className="text-5xl mb-3">👤</div><p>You're the only person in this room</p><p className="text-xs text-gray-400">Enjoy the privacy!</p></div>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">{notices.map(notice => (<div key={notice.id} className={`bg-white rounded-xl border p-5 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}><div className="flex items-center gap-2 mb-3"><h3 className="font-semibold text-lg">{notice.title}</h3>{notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs animate-pulse">URGENT</span>}<span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{notice.type}</span></div><p className="text-gray-600 mb-3">{notice.content}</p><p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p></div>))}{!notices.length && <div className="text-center py-12"><div className="text-5xl mb-3">📢</div><p>No notices yet</p></div>}</div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(complaint => (
              <div key={complaint.id} className="bg-white rounded-xl border p-5 shadow-sm relative group">
                <button onClick={() => deleteComplaint(complaint.id)} disabled={isSubmitting} className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition disabled:opacity-50">🗑️ Delete</button>
                <div className="flex justify-between items-start mb-3 pr-8">
                  <div><div className="flex items-center gap-2 mb-2"><h3 className="font-semibold">{complaint.title}</h3><span className={`px-2 py-1 rounded-full text-xs ${complaint.priority === 'high' ? 'bg-red-100 text-red-700' : complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{complaint.priority}</span></div><p className="text-gray-600">{complaint.description}</p>{complaint.admin_response && (<div className="mt-3 p-3 bg-green-50 rounded-lg"><p className="text-xs text-green-600 font-semibold mb-1">Owner's Response:</p><p className="text-sm text-gray-700">{complaint.admin_response}</p></div>)}</div>
                  <span className={`px-2 py-1 rounded-full text-xs ${complaint.status === 'open' ? 'bg-red-100 text-red-700' : complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{complaint.status === 'open' ? 'Open' : complaint.status === 'in_progress' ? 'In Progress' : 'Resolved'}</span>
                </div>
                <p className="text-xs text-gray-400">Submitted: {formatDate(complaint.created_at)}</p>
              </div>
            ))}
            {!complaints.length && <div className="text-center py-12"><div className="text-5xl mb-3">📝</div><p>No complaints filed yet</p><button onClick={() => setShowComplaintModal(true)} className="mt-3 text-slate-600 underline">Raise a complaint</button></div>}
          </div>
        )}

        {/* Payment History Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">UTR</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Screenshot</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{payment.upi_transaction_id || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          payment.status === 'success' ? 'bg-green-100 text-green-700' :
                          payment.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {payment.status === 'success' ? 'Success' : payment.status === 'payment_pending' ? 'Pending' : payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {payment.payment_screenshot ? (
                          <button 
                            onClick={() => { setScreenshotUrl(payment.payment_screenshot); setShowScreenshotModal(true); }}
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paymentHistory.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">No payment history yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPaymentModal && (
          <PayRentModal
            tenant={tenant}
            room={room}
            ownerUpiId={ownerUpiId}
            ownerUpiPhone={ownerUpiPhone}
            paymentAmount={paymentAmount}
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
