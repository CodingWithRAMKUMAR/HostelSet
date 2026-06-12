// lib/dodo.js
// Helper for Dodo Payments API (Live Mode)

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_API_BASE = 'https://api.dodopayments.com';

export async function createDodoOrder({ amount, currency, customerName, customerEmail, purpose, metadata }) {
  try {
    const url = `${DODO_API_BASE}/v1/orders`;  // ✅ Correct endpoint
    console.log('Dodo request URL:', url);
    console.log('Dodo API Key prefix:', DODO_API_KEY?.substring(0, 10) + '...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100,               // amount in paise
        currency: currency || 'INR',
        // ✅ Use "return_url" (not redirect_url) and "customer" (not customer_details)
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/payment/return`,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/api/payment/webhook`,
        description: `Payment for ${purpose}`,
        customer: {
          name: customerName,
          email: customerEmail,
        },
        metadata: {
          purpose,
          ...metadata,
        },
      }),
    });

    const responseText = await response.text();
    console.log('Dodo response status:', response.status);
    console.log('Dodo response body:', responseText);

    if (!response.ok) {
      let errorMessage = 'Dodo order creation failed';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {}
      throw new Error(`${errorMessage} (status: ${response.status})`);
    }

    const data = JSON.parse(responseText);
    // Dodo returns { id, payment_link } from the order creation
    return { success: true, orderId: data.id, paymentLink: data.payment_link };
  } catch (error) {
    console.error('Dodo order error:', error);
    return { success: false, error: error.message };
  }
}
