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

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Send a password reset email which doubles as a renewal prompt
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/owner/subscribe`,
      },
    });

    if (error) throw error;

    // Optional: Log this action in your audit log table if you have one
    // await supabaseAdmin.from('audit_logs').insert({ admin_id: '...', action: 'SENT_RENEWAL_EMAIL', target: ownerId });

    return res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: error.message });
  }
}