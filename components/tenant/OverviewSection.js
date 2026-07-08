import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils';
import { Skeleton } from '../ui/Skeleton';

export default function OverviewSection({ tenant, room, property, owner, pendingRoomChangeRequest, lastRoomChangeDecision, vacateRequest, lastVacateDecision }) {
  if (!tenant || !room) {
    return <div className="grid gap-6 md:grid-cols-2" aria-busy="true" aria-label="Loading profile"><Skeleton className="h-72 rounded-xl"/><Skeleton className="h-72 rounded-xl"/></div>;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Room Details */}
      <section className="max-w-full min-w-0 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
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
          <div className="flex min-w-0 flex-wrap justify-between gap-2 py-2 border-b">
            <span>Monthly Rent:</span>
            <span className="text-green-600 font-semibold">{formatCurrency(room.monthly_rent || 0)}</span>
          </div>
          <div className="flex min-w-0 flex-wrap justify-between gap-2 py-2 border-b">
            <span>Security Deposit:</span>
            <span className="font-semibold">{formatCurrency(tenant.security_deposit_amount || 0)} ({tenant.security_deposit_status?.replaceAll('_', ' ') || 'not required'})</span>
          </div>
          <div className="flex min-w-0 flex-wrap justify-between gap-2 py-2 border-b">
            <span>Move-in Date:</span>
            <span>{formatDate(tenant.move_in_date)}</span>
          </div>
          <div className="flex min-w-0 flex-wrap justify-between gap-2 py-2 border-b">
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
          {!vacateRequest && lastVacateDecision?.status === 'rejected' && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="status">
              <strong>Vacate request rejected.</strong>
              <div className="mt-1">{lastVacateDecision.rejection_reason || 'The owner did not provide a reason.'}</div>
              <div className="mt-2 text-xs text-red-500">You can submit another vacate request when eligible.</div>
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
      </section>

      {/* Property Information */}
      <section className="max-w-full min-w-0 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
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
      </section>
    </div>
  );
}
