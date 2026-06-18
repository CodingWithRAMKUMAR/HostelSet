// pages/api/payment/webhook.js
import crypto from 'crypto';
import { supabase } from '../../../lib/supabase';

const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify signature (if Dodo provides a signature header)
  const signature = req.headers['x-dodo-signature'];
  if (WEBHOOK_SECRET && signature) {
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (signature !== expected) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const event = req.body;
  const eventType = event.type;

  // Handle payment succeeded
  if (eventType === 'payment.succeeded') {
    const { order_id, payment_id, amount, metadata } = event.data;

    // Find transaction by dodo_order_id
    const { data: tx, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('dodo_order_id', order_id)
      .single();

    if (findError || !tx) {
      console.error('Transaction not found for order:', order_id);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update transaction status
    await supabase
      .from('payment_transactions')
      .update({
        status: 'success',
        dodo_payment_id: payment_id,
        webhook_received: true,
        updated_at: new Date(),
      })
      .eq('id', tx.id);

    // Handle rent payment
    if (tx.purpose === 'rent' && tx.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('pending_amount, total_paid')
        .eq('id', tx.tenant_id)
        .single();

      if (!tenantError && tenant) {
        const newPending = Math.max(0, (tenant.pending_amount || 0) - tx.amount);
        const newTotalPaid = (tenant.total_paid || 0) + tx.amount;
        await supabase
          .from('tenants')
          .update({
            pending_amount: newPending,
            total_paid: newTotalPaid,
            rent_status: newPending <= 0 ? 'paid' : 'pending',
            last_payment_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', tx.tenant_id);
      }
    }

    // Handle membership purchase
    if (tx.purpose === 'membership' && tx.owner_id) {
      const planId = tx.metadata?.planId;
      if (planId) {
        const { data: plan } = await supabase
          .from('membership_plans')
          .select('duration_months')
          .eq('id', planId)
          .single();

        if (plan) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + plan.duration_months);

          await supabase
            .from('owner_memberships')
            .upsert({
              owner_id: tx.owner_id,
              plan_id: planId,
              status: 'active',
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              payment_transaction_id: tx.id,
            });

          await supabase
            .from('properties')
            .update({
              membership_active: true,
              membership_expiry: endDate.toISOString().split('T')[0],
            })
            .eq('owner_id', tx.owner_id);
        }
      }
    }
  }

  // Handle payment failed (optional)
  if (eventType === 'payment.failed') {
    const { order_id } = event.data;
    await supabase
      .from('payment_transactions')
      .update({ status: 'failed', webhook_received: true })
      .eq('dodo_order_id', order_id);
  }

  res.status(200).json({ received: true });
}
