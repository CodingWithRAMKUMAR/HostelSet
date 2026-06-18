import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Extract token from Authorization header
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Missing token' })

  // Verify the calling user is an admin
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { ownerId, action, planId, durationDays } = req.body

  if (!ownerId || !action) return res.status(400).json({ error: 'Missing ownerId or action' })

  try {
    if (action === 'grant') {
      // Default to 30 days if no duration specified
      const days = durationDays || 30
      const plan = planId || 'monthly' // default plan
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + days)

      await supabaseAdmin.from('owner_memberships').upsert({
        owner_id: ownerId,
        plan_id: plan,
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_transaction_id: 'admin_grant',
      })

      await supabaseAdmin
        .from('properties')
        .update({
          membership_active: true,
          membership_expiry: endDate.toISOString().split('T')[0],
        })
        .eq('owner_id', ownerId)

      return res.status(200).json({ success: true, message: `Membership granted until ${endDate.toDateString()}` })
    }

    if (action === 'revoke') {
      await supabaseAdmin
        .from('owner_memberships')
        .delete()
        .eq('owner_id', ownerId)

      await supabaseAdmin
        .from('properties')
        .update({
          membership_active: false,
          membership_expiry: null,
        })
        .eq('owner_id', ownerId)

      return res.status(200).json({ success: true, message: 'Membership revoked' })
    }

    return res.status(400).json({ error: 'Invalid action. Use grant or revoke.' })
  } catch (error) {
    console.error('Admin membership error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
