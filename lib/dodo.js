// lib/dodo.js
// Helper for Dodo Payments API (Live Mode – correct endpoint & fields)

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_API_BASE = 'https://live.dodopayments.com';

// Your membership product ID from Dodo dashboard
const MEMBERSHIP_PRODUCT_ID = 'pdt_0NgsOeKIu8IFQi24BbANl';

export async function createDodoOrder({ amount, currency, customerName, customerEmail, purpose, metadata }) {
  try {
    const response = await fetch(`${DODO_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          country: 'IN',            // India (ISO alpha‑2)
        },
        customer: {
          email: customerEmail,
          name: customerName,
        },
        product_cart: [
          {
            product_id: MEMBERSHIP_PRODUCT_ID,
            quantity: 1,
            amount: amount * 100,   // amount in paise (₹499 = 49900)
          },
        ],
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/payment/return`,
        payment_link: true,         // Required to generate a hosted payment page
        metadata: {
          purpose,
          ...metadata,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    // Dodo returns { payment_id, payment_link, ... }
    return {
      success: true,
      orderId: data.payment_id,
      paymentLink: data.payment_link,
    };
  } catch (error) {
    console.error('Dodo order error:', error);
    return { success: false, error: error.message };
  }
}
