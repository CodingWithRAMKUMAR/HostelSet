// pages/api/payment/create-membership-order.js
import { supabase } from '../../../lib/supabase';
import { createDodoOrder } from '../../../lib/dodo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ownerId, planId, amount, ownerName, ownerEmail } = req.body;

  if (!ownerId || !planId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create order with Dodo
    const orderResult = await createDodoOrder({
      amount,
      currency: 'INR',
      customerName: ownerName,
      customerEmail: ownerEmail,
      purpose: 'membership',
      metadata: { ownerId, planId, type: 'membership' },
    });

    if (!orderResult.success) throw new Error(orderResult.error);

    // Store in payment_transactions
    const { error: dbError } = await supabase
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
