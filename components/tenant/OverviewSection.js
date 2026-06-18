import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils';
import { useRealtimeData } from '../../hooks/useRealtimeData';

export default function OverviewSection({ tenantId, propertyId }) {
  // Subscribe to all relevant tables
  const { data: tenants } = useRealtimeData('tenants');
  const { data: rooms } = useRealtimeData('rooms');
  const { data: properties } = useRealtimeData('properties');
  const { data: owners } = useRealtimeData('owners');
  const { data: roomChanges } = useRealtimeData('room_change_requests');

  // Filter for specific record
  const tenant = tenants.find(t => t.id === tenantId);
  const room = rooms.find(r => r.id === tenant?.room_id);
  const property = properties.find(p => p.id === propertyId);
  const owner = owners.find(o => o.id === property?.owner_id);
  const pendingRoomChangeRequest = roomChanges.find(r => r.tenant_id === tenantId && r.status === 'pending');

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
          {pendingRoomChangeRequest && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              ⏳ Room change request pending approval to Room {pendingRoomChangeRequest.new_room_id}.
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