// lib/dodo.js
// Helper for Dodo Payments API (Live Mode)

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_API_BASE = 'https://api.dodopayments.com'; // ✅ Live endpoint

export async function createDodoOrder({ amount, currency, customerName, customerEmail, purpose, metadata }) {
  try {
    const response = await fetch(`${DODO_API_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // convert to paise
        currency: currency || 'INR',
        payment_methods: ['upi', 'card', 'netbanking'],
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/payment/return`,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/api/payment/webhook`,
        description: `Payment for ${purpose}`,
        customer_details: {
          name: customerName,
          email: customerEmail,
        },
        metadata: {
          purpose,
          ...metadata,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Dodo order creation failed');
    return { success: true, orderId: data.id, paymentLink: data.payment_link };
  } catch (error) {
    console.error('Dodo order error:', error);
    return { success: false, error: error.message };
  }
}
