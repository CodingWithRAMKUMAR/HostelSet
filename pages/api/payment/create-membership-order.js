// pages/api/payment/create-membership-order.js
import { supabaseAdmin } from '../../../lib/supabase';
import { createDodoOrder } from '../../../lib/dodo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ownerId, planId } = req.body;
  const plans = {
    monthly: { amount: 499, name: 'Monthly' },
    yearly: { amount: 4999, name: 'Yearly' },
  };
  const selectedPlan = plans[planId];

  if (!ownerId || !selectedPlan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: 'Payment service is not configured' });

  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || user.id !== ownerId) return res.status(403).json({ error: 'Forbidden' });
    const { data: profile } = await supabaseAdmin.from('users').select('role, full_name, email').eq('id', user.id).single();
    if (profile?.role !== 'owner') return res.status(403).json({ error: 'Owners only' });

    const amount = selectedPlan.amount;
    // Create order with Dodo
    const orderResult = await createDodoOrder({
      amount,
      currency: 'INR',
      customerName: profile.full_name || user.user_metadata?.full_name || 'Hostel owner',
      customerEmail: profile.email || user.email,
      purpose: 'membership',
      metadata: { ownerId, planId, type: 'membership' },
    });

    if (!orderResult.success) throw new Error(orderResult.error);

    // Store in payment_transactions
    const { error: dbError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        order_id: `MEM_${Date.now()}_${ownerId}`,
        dodo_order_id: orderResult.orderId,
        owner_id: ownerId,
        amount,
        purpose: 'membership',
        status: 'pending',
        metadata: { planId, paymentLink: orderResult.paymentLink },
      });

    if (dbError) throw dbError;

    res.status(200).json({
      success: true,
      paymentLink: orderResult.paymentLink,
      orderId: orderResult.orderId,
    });
  } catch (error) {
    console.error('Create membership order error:', error);
    res.status(500).json({ error: error.message });
  }
}
