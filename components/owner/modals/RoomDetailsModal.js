import { useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, formatDate } from '../../../lib/utils';
import toast from 'react-hot-toast';

// Dynamically import the sub-modals (lazy-loaded)
const TenantPaymentsModal = dynamic(() => import('./TenantPaymentsModal'), { ssr: false });
const TenantProfileModal = dynamic(() => import('./TenantProfileModal'), { ssr: false });

export default function RoomDetailsModal({ 
  room, 
  tenantsInRoom, 
  onClose, 
  isSubmitting,
  getRoomNumberById,
  onUpdated
}) {
  // State for sub-modals
  const [showTenantPayments, setShowTenantPayments] = useState(false);
  const [showTenantProfile, setShowTenantProfile] = useState(false);
  const [selectedTenantForPayments, setSelectedTenantForPayments] = useState(null);
  const [selectedTenantForProfile, setSelectedTenantForProfile] = useState(null);
  const [tenantPayments, setTenantPayments] = useState([]);
  const [tenantApplication, setTenantApplication] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomSettings, setRoomSettings] = useState({ room_audience: room?.room_audience || 'coliving', deposit_amount: Number(room?.deposit_amount || 0) });

  if (!room) return null;

  // --- HANDLERS INSIDE THE MODAL ---
  const handleViewHistory = async (tenant) => {
    setSelectedTenantForPayments(tenant);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setTenantPayments(data || []);
      setShowTenantPayments(true);
    } catch (error) {
      toast.error('Failed to load payment history');
    }
  };

  const handleViewProfile = async (tenant) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .or(`phone.eq.${tenant.phone},email.eq.${tenant.email}`)
        .eq('property_id', room.property_id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      setTenantApplication(data?.[0] || null);
      setSelectedTenantForProfile(tenant);
      setShowTenantProfile(true);
    } catch (error) {
      toast.error('Could not fetch documents');
    } finally {
      setLoadingProfile(false);
    }
  };

  const saveRoomSettings = async () => {
    if (savingRoom) return;
    setSavingRoom(true);
    try {
      const values = { room_audience: roomSettings.room_audience, deposit_amount: Math.max(0, Number(roomSettings.deposit_amount || 0)) };
      const { data, error } = await supabase.from('rooms').update(values).eq('id', room.id).select().single();
      if (error) throw error;
      onUpdated?.(data);
      toast.success('Room application settings updated');
    } catch (error) { toast.error('Failed to update room: ' + error.message); }
    finally { setSavingRoom(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] p-6 border-b-2 border-orange-500/80 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Room {room.room_number} Details
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-2xl transition"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Room Information */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Room Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Room Number:</span>
                  <span className="font-medium text-gray-800">{room.room_number}</span>
                </div>
                <div className="border-t pt-3">
                  <label className="mb-1 block text-gray-500">Room category</label>
                  <select value={roomSettings.room_audience} onChange={e => setRoomSettings({...roomSettings, room_audience:e.target.value})} className="w-full rounded-lg border px-3 py-2">
                    <option value="boys">Boys Room</option><option value="girls">Girls Room</option><option value="coliving">Co-living Room</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Application deposit (₹)</label>
                  <input type="number" min="0" value={roomSettings.deposit_amount} onChange={e => setRoomSettings({...roomSettings, deposit_amount:e.target.value})} className="w-full rounded-lg border px-3 py-2" />
                </div>
                <button onClick={saveRoomSettings} disabled={savingRoom} className="w-full rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingRoom ? 'Saving…' : 'Save Room Settings'}</button>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sharing Type:</span>
                  <span className="font-medium text-gray-800 capitalize">{room.sharing_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Rent:</span>
                  <span className="font-medium text-gray-800">{formatCurrency(room.monthly_rent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-medium text-gray-800">{room.capacity} persons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Occupants:</span>
                  <span className="font-medium text-gray-800">{room.current_occupants}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Current Residents */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Current Residents</h3>
              {tenantsInRoom.length === 0 ? (
                <p className="text-gray-400 text-sm">No tenants currently in this room.</p>
              ) : (
                <div className="space-y-4">
                  {tenantsInRoom.map((tenant) => (
                    <div key={tenant.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{tenant.name}</p>
                          <p className="text-xs text-gray-500">📞 {tenant.phone}</p>
                          <p className="text-xs text-gray-500">Move-in: {formatDate(tenant.move_in_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">{formatCurrency(tenant.rent_amount)}<span className="text-xs text-gray-400 font-normal">/month</span></p>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            tenant.rent_status === 'paid' ? 'bg-green-100 text-green-700' :
                            tenant.rent_status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {tenant.rent_status === 'pending' ? 'Pending' : tenant.rent_status}
                          </span>
                        </div>
                      </div>

                      {/* BUTTONS (Triggers local handlers) */}
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => handleViewHistory(tenant)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                        >
                          History
                        </button>
                        <button 
                          onClick={() => handleViewProfile(tenant)} 
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                        >
                          Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose} 
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </motion.div>

      {/* INNER MODALS (Rendered entirely inside this file) */}
      {showTenantPayments && selectedTenantForPayments && (
        <TenantPaymentsModal
          tenant={selectedTenantForPayments}
          payments={tenantPayments}
          onClose={() => setShowTenantPayments(false)}
        />
      )}

      {showTenantProfile && selectedTenantForProfile && (
        <TenantProfileModal
          tenant={selectedTenantForProfile}
          application={tenantApplication}
          loading={loadingProfile}
          onClose={() => setShowTenantProfile(false)}
        />
      )}
    </motion.div>
  );
}
