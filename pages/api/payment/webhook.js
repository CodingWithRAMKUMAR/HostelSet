// pages/api/payment/webhook.js
import crypto from 'crypto';
import { supabase } from '../../../lib/supabase';

const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ SECURITY FIX: Make webhook signature validation mandatory
  if (!WEBHOOK_SECRET) {
    console.error('DODO_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not properly configured' });
  }

  const signature = req.headers['x-dodo-signature'];
  if (!signature) {
    console.error('Missing webhook signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (signature !== expected) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
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

    // ✅ ERROR HANDLING: Check for errors in transaction update
    const { error: txUpdateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'success',
        dodo_payment_id: payment_id,
        webhook_received: true,
        updated_at: new Date(),
      })
      .eq('id', tx.id);
    
    if (txUpdateError) {
      console.error('Failed to update payment transaction:', txUpdateError);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }

    // Handle rent payment
    if (tx.purpose === 'rent' && tx.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('pending_amount, total_paid')
        .eq('id', tx.tenant_id)
        .single();

      if (tenantError) {
        console.error('Failed to fetch tenant data:', tenantError);
        return res.status(500).json({ error: 'Failed to fetch tenant data' });
      }

      if (tenant) {
        const newPending = Math.max(0, (tenant.pending_amount || 0) - tx.amount);
        const newTotalPaid = (tenant.total_paid || 0) + tx.amount;
        const { error: tenantUpdateError } = await supabase
          .from('tenants')
          .update({
            pending_amount: newPending,
            total_paid: newTotalPaid,
            rent_status: newPending <= 0 ? 'paid' : 'pending',
            last_payment_date: new Date().toISOString().split('T')[0],
          })
          .eq('id', tx.tenant_id);
        
        if (tenantUpdateError) {
          console.error('Failed to update tenant payment:', tenantUpdateError);
          return res.status(500).json({ error: 'Failed to update tenant payment' });
        }
      }
    }

    // Handle membership purchase
    if (tx.purpose === 'membership' && tx.owner_id) {
      const planId = tx.metadata?.planId;
      if (planId) {
        const { data: plan, error: planError } = await supabase
          .from('membership_plans')
          .select('duration_months')
          .eq('id', planId)
          .single();

        if (planError) {
          console.error('Failed to fetch membership plan:', planError);
          return res.status(500).json({ error: 'Failed to fetch membership plan' });
        }

        if (plan) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + plan.duration_months);

          const { error: membershipError } = await supabase
            .from('owner_memberships')
            .upsert({
              owner_id: tx.owner_id,
              plan_id: planId,
              status: 'active',
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              payment_transaction_id: tx.id,
            });
          
          if (membershipError) {
            console.error('Failed to upsert owner membership:', membershipError);
            return res.status(500).json({ error: 'Failed to update membership' });
          }

          const { error: propError } = await supabase
            .from('properties')
            .update({
              membership_active: true,
              membership_expiry: endDate.toISOString().split('T')[0],
            })
            .eq('owner_id', tx.owner_id);
          
          if (propError) {
            console.error('Failed to update property membership:', propError);
            return res.status(500).json({ error: 'Failed to update properties' });
          }
        }
      }
    }
  }

  // Handle payment failed (optional)
  if (eventType === 'payment.failed') {
    const { order_id } = event.data;
    const { error: failError } = await supabase
      .from('payment_transactions')
      .update({ status: 'failed', webhook_received: true })
      .eq('dodo_order_id', order_id);
    
    if (failError) {
      console.error('Failed to update failed payment transaction:', failError);
      return res.status(500).json({ error: 'Failed to update failed transaction' });
    }
  }

  res.status(200).json({ received: true });
}
