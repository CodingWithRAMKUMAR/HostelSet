// pages/api/admin/send-renewal-email.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Read API Key from Vercel Environment Variable
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!brevoApiKey) {
      return res.status(500).json({
        success: false,
        error: 'BREVO_API_KEY not found'
      });
    }

    console.log('Brevo Key Loaded:', brevoApiKey.substring(0, 8));

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>🏠 HostelSet Membership Renewal Reminder</h2>

        <p>Hello ${name || 'Owner'},</p>

        <p>
          Your HostelSet membership is about to expire.
          Renew now to keep your property active and visible to tenants.
        </p>

        <div style="margin:30px 0;">
          <a
            href="https://hostelset.com/owner/subscribe"
            style="
              background:#ea580c;
              color:white;
              padding:12px 20px;
              text-decoration:none;
              border-radius:6px;
              display:inline-block;
            "
          >
            Renew Membership
          </a>
        </div>

        <p>Thank you for choosing HostelSet.</p>

        <p>
          Regards,<br>
          HostelSet Team
        </p>
      </div>
    `;

    const response = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': brevoApiKey
        },
        body: JSON.stringify({
          sender: {
            name: 'HostelSet',
            email: 'noreply@hostelset.com'
          },
          to: [
            {
              email,
              name: name || 'Owner'
            }
          ],
          subject: 'HostelSet Membership Renewal Reminder',
          htmlContent: emailHtml
        })
      }
    );

    const data = await response.json();

    console.log('Brevo Status:', response.status);
    console.log('Brevo Response:', data);

    if (!response.ok) {
      throw new Error(
        data.message || `Brevo Error (${response.status})`
      );
    }

    console.log(`✅ Email sent successfully to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Renewal email sent successfully',
      data
    });

  } catch (error) {
    console.error('Email Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}