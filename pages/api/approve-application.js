import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { applicationId } = req.body

  if (!applicationId) {
    return res.status(400).json({ error: 'Application ID is required' })
  }

  try {
    // First, fetch the application to check its current status
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return res.status(500).json({ error: 'Failed to fetch application' })
    }

    if (!application) {
      return res.status(404).json({ error: 'Application not found' })
    }

    // CRITICAL FIX: Check if already approved to prevent duplicate
    if (application.status === 'approved') {
      return res.status(400).json({ 
        error: 'Application already approved',
        alreadyApproved: true 
      })
    }

    // Check if already rejected
    if (application.status === 'rejected') {
      return res.status(400).json({ 
        error: 'Application already rejected',
        alreadyRejected: true 
      })
    }

    // Check if status is pending
    if (application.status !== 'pending') {
      return res.status(400).json({ 
        error: `Cannot approve application with status: ${application.status}` 
      })
    }

    // Update application status to approved
    const { error: updateError } = await supabase
      .from('applications')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Update error:', updateError)
      return res.status(500).json({ error: 'Failed to update application status' })
    }

    // Check if tenant already exists for this user and property
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', application.user_id)
      .eq('property_id', application.property_id)
      .maybeSingle()

    if (!existingTenant) {
      // Add as tenant only if doesn't exist
      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({
          user_id: application.user_id,
          property_id: application.property_id,
          name: application.name,
          phone: application.phone,
          email: application.email,
          rent_amount: 0, // Will be set by owner
          pending_amount: 0,
          total_paid: 0,
          rent_status: 'pending',
          move_in_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })

      if (tenantError) {
        console.error('Tenant creation error:', tenantError)
        // Don't return error, application is already approved
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Application approved successfully' 
    })

  } catch (error) {
    console.error('Approve application error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
