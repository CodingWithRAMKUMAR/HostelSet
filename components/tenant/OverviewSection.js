import { formatDate, formatCurrency, getSharingDetails } from '../../lib/utils'

export default function OverviewSection({ tenant = {}, room = {}, property = {}, owner = {}, pendingRoomChangeRequest = null }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">🏠 Your Room Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Room Number:</span>
            <span>{room?.room_number}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Sharing Type:</span>
            <span>{getSharingDetails(room?.sharing_type || '')?.label || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Monthly Rent:</span>
            <span className="text-green-600 font-semibold">{formatCurrency(room?.monthly_rent || 0)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Move-in Date:</span>
            <span>{formatDate(tenant?.move_in_date)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs ${tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {tenant?.status === 'active' ? 'Active' : 'Notice Period'}
            </span>
          </div>
          {pendingRoomChangeRequest && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              ⏳ Room change request pending approval to Room {pendingRoomChangeRequest.new_room_id}.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">🏢 Property Information</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">Property Name:</span>
            <span>{property?.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Address:</span>
            <span className="text-right">{property?.address}, {property?.city}</span>
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
  )
}
