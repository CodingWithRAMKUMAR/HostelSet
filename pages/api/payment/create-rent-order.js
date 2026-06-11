// pages/api/payment/create-rent-order.js
import { supabase } from '../../../lib/supabase';
import { createDodoOrder } from '../../../lib/dodo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tenantId, amount, tenantName, tenantEmail } = req.body;

  if (!tenantId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid tenant or amount' });
  }

  try {
    // 1. Fetch tenant details and owner's UPI ID
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, email, property:properties(owner_upi_id, owner:users(email))')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) throw new Error('Tenant not found');

    const ownerUpi = tenant.property?.owner_upi_id;
    if (!ownerUpi) {
      return res.status(400).json({ error: 'Owner has not set their UPI ID. Please contact owner.' });
    }

    // 2. Create order with Dodo
    const orderResult = await createDodoOrder({
      amount,
      currency: 'INR',
      customerName: tenantName,
      customerEmail: tenantEmail || tenant.email || 'tenant@example.com',
      purpose: 'rent',
      metadata: { tenantId, ownerUpi, type: 'rent' },
    });

    if (!orderResult.success) throw new Error(orderResult.error);

    // 3. Store order in database
    const { error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        order_id: `RENT_${Date.now()}_${tenantId}`,
        dodo_order_id: orderResult.orderId,
        tenant_id: tenantId,
        amount,
        purpose: 'rent',
        status: 'pending',
        metadata: { ownerUpi, paymentLink: orderResult.paymentLink },
      });

    if (dbError) throw dbError;

    // 4. Return payment link to frontend
    res.status(200).json({
      success: true,
      paymentLink: orderResult.paymentLink,
      orderId: orderResult.orderId,
    });
  } catch (error) {
    console.error('Create rent order error:', error);
    res.status(500).json({ error: error.message });
  }
}
