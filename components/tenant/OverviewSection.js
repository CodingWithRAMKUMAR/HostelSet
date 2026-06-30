import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils';

export default function OverviewSection({ tenant, room, property, owner, pendingRoomChangeRequest, lastRoomChangeDecision, vacateRequest }) {
  if (!tenant || !room) {
    return <div className="text-center py-12 text-gray-500">Loading your profile...</div>;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Room Details */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">🏠 Your Room Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Room Number:</span>
            <span>{room.room_number}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Sharing Type:</span>
            <span>{getSharingDetails(room.sharing_type || '')?.label || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Monthly Rent:</span>
            <span className="text-green-600 font-semibold">{formatCurrency(room.monthly_rent || 0)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Move-in Date:</span>
            <span>{formatDate(tenant.move_in_date)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs ${tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {tenant.status === 'active' ? 'Active' : 'Notice Period'}
            </span>
          </div>
          {vacateRequest && (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${vacateRequest.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <strong>{vacateRequest.status === 'approved' ? 'Vacate request approved.' : 'Vacate request pending approval.'}</strong>
              <div className="mt-1">Expected checkout: {formatDate(vacateRequest.expected_check_out)}</div>
            </div>
          )}
          {!vacateRequest && pendingRoomChangeRequest && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              ⏳ Room change request pending approval to Room {pendingRoomChangeRequest.new_room_id}.
            </div>
          )}
          {!vacateRequest && !pendingRoomChangeRequest && lastRoomChangeDecision?.status === 'rejected' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <strong>Room change rejected.</strong>
              <div className="mt-1">{lastRoomChangeDecision.rejection_reason || 'The owner did not provide a reason.'}</div>
              <div className="text-xs mt-2 text-red-500">You can submit another room-change request.</div>
            </div>
          )}
          {!vacateRequest && !pendingRoomChangeRequest && lastRoomChangeDecision?.status === 'approved' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
              Your latest room-change request was approved.
            </div>
          )}
        </div>
      </div>

      {/* Property Information */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">🏢 Property Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Property Name:</span>
            <span>{property?.name || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Address:</span>
            <span className="text-right">{property?.address || 'N/A'}, {property?.city || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Owner Name:</span>
            <span>{owner?.full_name || 'Not provided'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Owner Contact:</span>
            <span className="font-medium">{property?.contact_number || owner?.phone || 'Not provided'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
