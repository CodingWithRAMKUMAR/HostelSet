import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify admin from session
  const token = req.headers.authorization?.split('Bearer ')[1]
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Check if user is admin
  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { ownerId } = req.body
  if (!ownerId) return res.status(400).json({ error: 'Missing ownerId' })

  // Grant 12 months free membership (plan = 'monthly'? we'll use 'yearly' for 12 months)
  const planId = 'yearly' // you can also use 'monthly' and set duration=12 later, but yearly plan is 12 months
  const startDate = new Date()
  const endDate = new Date()
  endDate.setFullYear(endDate.getFullYear() + 1) // 12 months

  const { error: upsertError } = await supabaseAdmin
    .from('owner_memberships')
    .upsert({
      owner_id: ownerId,
      plan_id: planId,
      status: 'active',
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      payment_transaction_id: 'admin_grant',
    })

  if (upsertError) {
    console.error('Grant membership error:', upsertError)
    return res.status(500).json({ error: 'Database error' })
  }

  // Also update the property record
  await supabaseAdmin
    .from('properties')
    .update({
      membership_active: true,
      membership_expiry: endDate.toISOString().split('T')[0],
    })
    .eq('owner_id', ownerId)

  return res.status(200).json({ success: true })
}
