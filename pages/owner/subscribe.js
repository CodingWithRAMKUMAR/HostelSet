// pages/owner/subscribe.js
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function SubscribePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const initiateMembershipPayment = async (planId, amount, planName) => {
    setLoading(true)
    try {
      const response = await fetch('/api/payment/create-membership-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: localStorage.getItem('userId'),
          planId,
          amount,
          ownerName: localStorage.getItem('userName'),
          ownerEmail: localStorage.getItem('userEmail'),
        }),
      })
      const data = await response.json()
      if (data.success) {
        window.open(data.paymentLink, '_blank')
        toast.success('Redirecting to payment gateway...')
        // Poll for membership activation
        setTimeout(async () => {
          const { data: membership } = await supabase
            .from('owner_memberships')
            .select('status, end_date')
            .eq('owner_id', localStorage.getItem('userId'))
            .maybeSingle()

          if (membership && membership.status === 'active' && new Date(membership.end_date) > new Date()) {
            toast.success('✅ Membership activated! Redirecting to dashboard...')
            router.push('/owner/dashboard')
          } else {
            toast('Payment processing – please wait a few moments.', { icon: '⏳' })
          }
        }, 15000)
      } else {
        toast.error(data.error || 'Payment initiation failed')
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Failed to initiate payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">⭐ Subscribe to HostelSet</h1>
          <p className="text-gray-500 mt-2">Choose a plan to unlock all features and manage your property effortlessly.</p>
          {router.query.reason === 'expired' && (
            <p className="text-red-600 font-semibold mt-4">Your membership has expired. Renew to regain access.</p>
          )}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => initiateMembershipPayment('monthly', 499, 'Monthly')}
            disabled={loading}
            className="w-full p-6 bg-white rounded-xl border border-gray-200 text-left hover:shadow-md transition"
          >
            <div className="font-bold text-xl">Monthly Plan</div>
            <div className="text-lg text-slate-700">₹499 / month</div>
            <div className="text-sm text-gray-500 mt-2">✓ Basic support</div>
            <div className="text-sm text-gray-500">✓ Up to 50 tenants</div>
          </button>

          <button
            onClick={() => initiateMembershipPayment('yearly', 4999, 'Yearly')}
            disabled={loading}
            className="w-full p-6 bg-white rounded-xl border border-gray-200 text-left hover:shadow-md transition"
          >
            <div className="font-bold text-xl">Yearly Plan</div>
            <div className="text-lg text-slate-700">₹4,999 / year</div>
            <div className="text-sm text-gray-500 mt-2">✓ Priority support</div>
            <div className="text-sm text-gray-500">✓ Unlimited tenants</div>
            <div className="text-sm text-gray-500">✓ Analytics dashboard</div>
          </button>
        </div>

        <button
          onClick={() => router.push('/owner/dashboard')}
          className="w-full mt-6 py-3 text-gray-600 hover:text-gray-800 transition"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}
