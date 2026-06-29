import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const PLANS = [
  { id: 'monthly', name: 'Monthly Plan', amount: 499, description: 'One month of HostelSet access' },
  { id: 'yearly', name: 'Yearly Plan', amount: 4999, description: 'One year of HostelSet access' },
];

export default function SubscribePage() {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState(null);
  const [property, setProperty] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadMembershipState = async (userId) => {
    const [{ data: propertyData, error: propertyError }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.from('properties').select('id, membership_active, membership_expiry').eq('owner_id', userId).maybeSingle(),
      supabase.from('membership_requests').select('id, plan_id, amount, status, requested_at, admin_note').eq('owner_id', userId).eq('status', 'pending').maybeSingle(),
    ]);
    if (propertyError) throw propertyError;
    if (requestError) throw requestError;
    setProperty(propertyData || null);
    setPendingRequest(requestData || null);
    if (propertyData?.membership_active && new Date(propertyData.membership_expiry) > new Date()) {
      await router.replace('/owner/dashboard');
    }
  };

  useEffect(() => {
    let channel;
    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          await router.replace('/login');
          return;
        }
        setOwnerId(session.user.id);
        await loadMembershipState(session.user.id);
        channel = supabase
          .channel(`owner-membership-request:${session.user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_requests', filter: `owner_id=eq.${session.user.id}` }, () => loadMembershipState(session.user.id))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'properties', filter: `owner_id=eq.${session.user.id}` }, () => loadMembershipState(session.user.id))
          .subscribe();
      } catch (error) {
        toast.error('Failed to load membership: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    initialize();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [router]);

  const requestMembership = async (plan) => {
    if (!ownerId || !property?.id || pendingRequest || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('membership_requests').insert({
        owner_id: ownerId,
        property_id: property.id,
        plan_id: plan.id,
        amount: plan.amount,
        status: 'pending',
      }).select('id, plan_id, amount, status, requested_at, admin_note').single();
      if (error) throw error;
      setPendingRequest(data);
      toast.success('Request sent. The admin will review it shortly.');
    } catch (error) {
      toast.error(error.code === '23505' ? 'You already have a pending request.' : 'Failed to send request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-600">Loading membership…</div>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">⭐ Request HostelSet Membership</h1>
          <p className="text-gray-500 mt-2">Select a plan. Your request will appear immediately in the admin dashboard.</p>
          {router.query.reason === 'expired' && <p className="text-red-600 font-semibold mt-4">Your membership has expired. Submit a renewal request.</p>}
        </div>

        {pendingRequest ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <h2 className="font-bold text-amber-900">Approval pending</h2>
            <p className="text-sm text-amber-800 mt-2">Your {pendingRequest.plan_id} plan request is waiting for admin review. This page updates automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {PLANS.map((plan) => (
              <button key={plan.id} type="button" onClick={() => requestMembership(plan)} disabled={submitting || !property} className="w-full p-6 bg-white rounded-xl border border-gray-200 text-left hover:shadow-md transition disabled:opacity-50">
                <div className="font-bold text-xl">{plan.name}</div>
                <div className="text-lg text-slate-700">₹{plan.amount.toLocaleString('en-IN')}</div>
                <div className="text-sm text-gray-500 mt-2">{plan.description}</div>
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={() => router.push('/owner/dashboard')} className="w-full mt-6 py-3 text-gray-600 hover:text-gray-800 transition">← Back to Dashboard</button>
      </div>
    </main>
  );
}
