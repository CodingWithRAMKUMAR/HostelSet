import { Webhook } from 'standardwebhooks';
import { supabaseAdmin } from '../../../lib/supabase';

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DODO_WEBHOOK_SECRET || !supabaseAdmin) {
    return res.status(500).json({ error: 'Webhook is not configured' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const headers = {
      'webhook-id': req.headers['webhook-id'],
      'webhook-signature': req.headers['webhook-signature'],
      'webhook-timestamp': req.headers['webhook-timestamp'],
    };
    event = new Webhook(process.env.DODO_WEBHOOK_SECRET).verify(rawBody, headers);
  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const dodoPaymentId = event.data?.payment_id || event.data?.order_id;
    if (!dodoPaymentId) return res.status(400).json({ error: 'Payment ID missing' });

    if (event.type === 'payment.failed') {
      const { error } = await supabaseAdmin
        .from('payment_transactions')
        .update({ status: 'failed', webhook_received: true, updated_at: new Date().toISOString() })
        .eq('dodo_order_id', dodoPaymentId);
      if (error) throw error;
      return res.status(200).json({ received: true });
    }

    if (event.type !== 'payment.succeeded') {
      return res.status(200).json({ received: true });
    }

    const { data: tx, error: findError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('dodo_order_id', dodoPaymentId)
      .single();
    if (findError || !tx) return res.status(404).json({ error: 'Transaction not found' });

    // Dodo retries webhooks. A completed transaction must never be applied twice.
    if (tx.status === 'success') return res.status(200).json({ received: true, duplicate: true });

    const { error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: 'processing',
        dodo_payment_id: dodoPaymentId,
        webhook_received: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id)
      .neq('status', 'success');
    if (transactionError) throw transactionError;

    if (tx.purpose === 'rent' && tx.tenant_id) {
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('pending_amount, total_paid')
        .eq('id', tx.tenant_id)
        .single();
      if (tenantError) throw tenantError;

      const newPending = Math.max(0, (tenant.pending_amount || 0) - tx.amount);
      const { error: updateTenantError } = await supabaseAdmin.from('tenants').update({
        pending_amount: newPending,
        total_paid: (tenant.total_paid || 0) + tx.amount,
        rent_status: newPending <= 0 ? 'paid' : 'pending',
        last_payment_date: new Date().toISOString().split('T')[0],
      }).eq('id', tx.tenant_id);
      if (updateTenantError) throw updateTenantError;

      const { error: historyError } = await supabaseAdmin.from('payment_history').insert({
        tenant_id: tx.tenant_id,
        amount: tx.amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'dodo',
        status: 'success',
        upi_transaction_id: dodoPaymentId,
      });
      if (historyError) throw historyError;
    }

    if (tx.purpose === 'membership' && tx.owner_id) {
      const planId = tx.metadata?.planId;
      const { data: plan, error: planError } = await supabaseAdmin
        .from('membership_plans')
        .select('duration_months')
        .eq('id', planId)
        .single();
      if (planError || !plan) throw planError || new Error('Membership plan not found');

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + plan.duration_months);

      const { error: membershipError } = await supabaseAdmin.from('owner_memberships').upsert({
        owner_id: tx.owner_id,
        plan_id: planId,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_transaction_id: tx.id,
      }, { onConflict: 'owner_id' });
      if (membershipError) throw membershipError;

      const { error: propertyError } = await supabaseAdmin.from('properties').update({
        membership_active: true,
        membership_expiry: endDate.toISOString().split('T')[0],
      }).eq('owner_id', tx.owner_id);
      if (propertyError) throw propertyError;
    }

    const { error: completedError } = await supabaseAdmin
      .from('payment_transactions')
      .update({ status: 'success', updated_at: new Date().toISOString() })
      .eq('id', tx.id);
    if (completedError) throw completedError;

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
