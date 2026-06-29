import { supabaseAdmin } from '../../../lib/supabase';
import { createDodoOrder } from '../../../lib/dodo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Payment service is not configured' });

  const { tenantId } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'Tenant is required' });

  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid session' });

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, user_id, name, email, pending_amount, rent_amount, property:properties(owner_upi_id)')
      .eq('id', tenantId)
      .single();
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });

    const amount = Number(tenant.pending_amount || tenant.rent_amount || 0);
    if (amount <= 0) return res.status(400).json({ error: 'No rent is currently due' });
    if (!tenant.property?.owner_upi_id) return res.status(400).json({ error: 'Owner payment details are unavailable' });

    const orderResult = await createDodoOrder({
      amount,
      currency: 'INR',
      customerName: tenant.name,
      customerEmail: tenant.email || user.email,
      purpose: 'rent',
      metadata: { tenantId, type: 'rent' },
    });
    if (!orderResult.success) throw new Error(orderResult.error);

    const { error: dbError } = await supabaseAdmin.from('payment_transactions').insert({
      order_id: `RENT_${Date.now()}_${tenantId}`,
      dodo_order_id: orderResult.orderId,
      tenant_id: tenantId,
      amount,
      purpose: 'rent',
      status: 'pending',
      metadata: { paymentLink: orderResult.paymentLink },
    });
    if (dbError) throw dbError;

    return res.status(200).json({ success: true, paymentLink: orderResult.paymentLink, orderId: orderResult.orderId });
  } catch (error) {
    console.error('Create rent order error:', error);
    return res.status(500).json({ error: 'Unable to create rent payment' });
  }
}
