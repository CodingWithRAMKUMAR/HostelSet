import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { supabase, signPrivateDocumentFields, findTenantDocumentRecord } from '../../../lib/supabase';
import { formatCurrency, formatDate } from '../../../lib/utils';
import toast from 'react-hot-toast';

// Dynamically import the sub-modals (lazy-loaded)
const TenantPaymentsModal = dynamic(() => import('./TenantPaymentsModal'), { ssr: false });
const TenantProfileModal = dynamic(() => import('./TenantProfileModal'), { ssr: false });
const ScreenshotModal = dynamic(() => import('./ScreenshotModal'), { ssr: false });

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
  const [tenantExtraDocuments, setTenantExtraDocuments] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomSettings, setRoomSettings] = useState({
    room_number: room?.room_number || '',
    monthly_rent: room?.monthly_rent ?? 0,
    capacity: room?.capacity ?? 1,
    sharing_type: room?.sharing_type || 'single',
    room_audience: room?.room_audience || 'coliving',
  });

  useEffect(() => { TenantPaymentsModal.preload?.(); TenantProfileModal.preload?.(); }, []);
  useEffect(() => {
    if (!room) return;
    setRoomSettings({ room_number:room.room_number || '', monthly_rent:room.monthly_rent ?? 0, capacity:room.capacity ?? 1, sharing_type:room.sharing_type || 'single', room_audience:room.room_audience || 'coliving' });
  }, [room?.id]);

  if (!room) return null;

  // --- HANDLERS INSIDE THE MODAL ---
  const handleViewHistory = async (tenant) => {
    setSelectedTenantForPayments(tenant);
    setShowTenantPayments(true);
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      setTenantPayments(await Promise.all((data || []).map(item => signPrivateDocumentFields(item, ['payment_screenshot']))));
    } catch (error) {
      toast.error('Failed to load payment history');
    } finally { setLoadingPayments(false); }
  };

  const handleViewProfile = async (tenant) => {
    setSelectedTenantForProfile(tenant);
    setShowTenantProfile(true);
    setLoadingProfile(true);
    try {
      const [tenantResult, paymentHistoryResult] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', tenant.id).eq('property_id', room.property_id).single(),
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
      const { record, source_type } = await findTenantDocumentRecord(fullTenant, room.property_id);
      const signed = record ? await signPrivateDocumentFields({ ...record, source_type }, ['id_proof', 'photo', 'payment_screenshot']) : null;
      const signedHistory = await Promise.all((paymentHistoryResult.data || []).map(item => signPrivateDocumentFields(item, ['payment_screenshot'])));
      const extraDocuments = signedHistory
        .filter(item => item.payment_screenshot)
        .map((item, index) => ({ label: `Payment receipt ${index + 1}`, url: item.payment_screenshot }));
      setSelectedTenantForProfile(signedTenant);
      setTenantApplication(signed);
      setTenantExtraDocuments(extraDocuments);
    } catch (error) {
      toast.error('Could not fetch documents');
    } finally {
      setLoadingProfile(false);
    }
  };

  const saveRoomSettings = async () => {
    if (savingRoom) return;
    const roomNumber = roomSettings.room_number.trim();
    const monthlyRent = Number(roomSettings.monthly_rent);
    const capacity = Number(roomSettings.capacity);
    if (!roomNumber) { toast.error('Room number is required'); return; }
    if (!Number.isFinite(monthlyRent) || monthlyRent < 0) { toast.error('Monthly rent cannot be negative'); return; }
    if (!Number.isInteger(capacity) || capacity <= 0) { toast.error('Capacity must be a positive whole number'); return; }
    if (capacity < room.current_occupants) { toast.error('Capacity cannot be lower than current occupants'); return; }
    setSavingRoom(true);
    try {
      const { data, error } = await supabase.rpc('update_owner_room', {
        p_room_id: room.id,
        p_room_number: roomNumber,
        p_monthly_rent: monthlyRent,
        p_capacity: capacity,
        p_sharing_type: roomSettings.sharing_type,
        p_room_audience: roomSettings.room_audience,
      });
      if (error) throw error;
      await onUpdated?.(data);
      toast.success('Room updated');
    } catch (error) { toast.error('Failed to update room: ' + error.message); }
    finally { setSavingRoom(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="flex max-h-[calc(100dvh_-_1rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[86dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-orange-500/70 bg-slate-950 px-3 py-3 text-white">
          <h2 className="truncate text-base font-black tracking-tight text-white sm:text-lg">
            Room {room.room_number} Details
          </h2>
          <button 
            onClick={onClose} 
            className="flex h-9 w-9 items-center justify-center rounded-xl text-2xl text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            
            {/* Left Column: Room Information */}
            <div>
              <h3 className="mb-2 border-b border-gray-200 pb-2 text-sm font-black text-gray-800">Room Information</h3>
              <div className="space-y-2.5 text-sm">
                <div>
                  <label className="mb-1 block text-gray-500">Room Number</label>
                  <input required value={roomSettings.room_number} onChange={event => setRoomSettings({...roomSettings, room_number:event.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Monthly Rent</label>
                  <input type="number" min="0" step="0.01" value={roomSettings.monthly_rent} onChange={event => setRoomSettings({...roomSettings, monthly_rent:event.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Capacity</label>
                  <input type="number" min={Math.max(1, room.current_occupants)} step="1" value={roomSettings.capacity} onChange={event => setRoomSettings({...roomSettings, capacity:event.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                  <p className="mt-1 text-xs text-gray-400">Current occupants: {room.current_occupants}</p>
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Sharing Type</label>
                  <select value={roomSettings.sharing_type} onChange={event => setRoomSettings({...roomSettings, sharing_type:event.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                    <option value="single">Single Sharing</option><option value="double">Double Sharing</option><option value="triple">Triple Sharing</option><option value="four">Four Sharing</option><option value="five">Five Sharing</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Room category</label>
                  <select value={roomSettings.room_audience} onChange={e => setRoomSettings({...roomSettings, room_audience:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                    <option value="boys">Boys Room</option><option value="girls">Girls Room</option><option value="coliving">Co-living Room</option>
                  </select>
                </div>                <div className="rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">Universal application deposit: <strong>&#8377;3,000</strong></div>                <button onClick={saveRoomSettings} disabled={savingRoom} className="w-full rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{savingRoom ? 'Saving...' : 'Save Room Settings'}</button>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Occupants:</span>
                  <span className="font-medium text-gray-800">{room.current_occupants}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Current Residents */}
            <div>
              <h3 className="mb-2 border-b border-gray-200 pb-2 text-sm font-black text-gray-800">Current Residents</h3>
              {tenantsInRoom.length === 0 ? (
                <p className="text-gray-400 text-sm">No tenants currently in this room.</p>
              ) : (
                <div className="space-y-3">
                  {tenantsInRoom.map((tenant) => (
                    <div key={tenant.id} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-800">{tenant.name}</p>                          <p className="text-xs text-gray-500">{tenant.phone}</p>
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
                      <div className="mt-2 flex flex-wrap gap-2">
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
        <div className="sticky bottom-0 flex shrink-0 justify-end border-t border-gray-100 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <button 
            onClick={onClose} 
            className="rounded-xl bg-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-300"
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
          loading={loadingPayments}
          onClose={() => setShowTenantPayments(false)}
          onViewScreenshot={setScreenshotUrl}
        />
      )}

      {showTenantProfile && selectedTenantForProfile && (
        <TenantProfileModal
          tenant={selectedTenantForProfile}
          application={tenantApplication}
          extraDocuments={tenantExtraDocuments}
          loading={loadingProfile}
          onClose={() => setShowTenantProfile(false)}
          onViewScreenshot={setScreenshotUrl}
        />
      )}

      {screenshotUrl && <ScreenshotModal url={screenshotUrl} onClose={() => setScreenshotUrl('')} />}
    </motion.div>
  );
}
