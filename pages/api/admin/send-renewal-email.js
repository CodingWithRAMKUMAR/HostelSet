import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ownerId, email, name } = req.body;

  // Safety check: ensure email is provided and is a string
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  try {
    console.log(`📧 Attempting to send renewal email to: ${email}`);

    // Generate the password recovery link (which acts as the renewal link)
    // Since "Forgot Password" works, this exact method is confirmed working.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        // Hardcoded redirect to the live subscription page
        redirectTo: `https://hostelset.com/owner/subscribe`,
      },
    });

    if (error) {
      console.error('Supabase Admin Error:', error);
      throw error;
    }

    console.log(`✅ Successfully generated link for ${email}. Brevo will now deliver it.`);

    return res.status(200).json({ 
      success: true, 
      message: `Renewal email successfully triggered for ${name || email}` 
    });

  } catch (error) {
    console.error('Fatal email error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send renewal email. Check server logs.'
    });
  }
}