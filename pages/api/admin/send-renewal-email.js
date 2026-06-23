export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
      throw new Error('Brevo API key is not configured in environment variables.');
    }

    // Premium branded email
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px; padding: 20px;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #ea580c; padding-bottom: 10px;">🏠 HostelSet</h2>
        <p>Dear ${name || 'Owner'},</p>
        <p>We noticed your HostelSet membership is about to expire. To ensure your property stays active and visible to tenants, please renew your membership by clicking the button below.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hostelset.com/owner/subscribe" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Renew Membership Now
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">If you have any questions, please contact our support team.</p>
        <p style="color: #666; font-size: 14px;">Best regards,<br>HostelSet Team</p>
      </div>
    `;

    // Send directly via Brevo's official API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'HostelSet',
          email: 'noreply@hostelset.com'
        },
        to: [
          {
            email: email,
            name: name || 'Owner'
          }
        ],
        subject: 'HostelSet Membership Renewal Reminder',
        htmlContent: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API Error:', data);
      throw new Error(data.message || 'Brevo API error');
    }

    console.log(`✅ Email successfully sent via Brevo to ${email}`);
    return res.status(200).json({ success: true, message: 'Renewal email sent successfully' });

  } catch (error) {
    console.error('Email Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}