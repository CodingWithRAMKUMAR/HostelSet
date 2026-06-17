import { motion } from 'framer-motion'
import { formatCurrency } from '../../../lib/utils'

export default function PayRentModal({
  tenant,
  room,
  ownerUpiId,
  ownerUpiPhone,
  paymentTransactionId,
  setPaymentTransactionId,
  paymentScreenshot,
  setPaymentScreenshot,
  paymentLoading,
  isSubmitting,
  initiateUPIPayment,
  copyUpiId,
  copyUpiPhone,
  submitPaymentWithProof,
  onCancel,
}) {
  const amount = tenant?.pending_amount || tenant?.rent_amount || 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">💳 Pay Rent via UPI</h2>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-semibold">{tenant?.name}</p>
          <p className="text-sm text-gray-500">Room {room?.room_number}</p>
          <p>Monthly Rent: {formatCurrency(tenant?.rent_amount)}</p>
          <p className="text-red-500">Pending: {formatCurrency(amount)}</p>
        </div>
        {(ownerUpiId || ownerUpiPhone) ? (
          <div className="space-y-4">
            {ownerUpiId && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-semibold mb-2">Pay to UPI ID</p>
                <p className="font-mono text-sm break-all mb-2">{ownerUpiId}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => initiateUPIPayment(ownerUpiId, amount)} className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-700 transition">Pay Now</button>
                  <button onClick={() => copyUpiId(ownerUpiId)} className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-700 transition">Copy UPI ID</button>
                </div>
              </div>
            )}
            {ownerUpiPhone && (
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-sm font-semibold mb-2">Pay to UPI Phone Number</p>
                <p className="font-mono text-sm break-all mb-2">{ownerUpiPhone}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => initiateUPIPayment(ownerUpiPhone, amount)} className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-700 transition">Pay Now</button>
                  <button onClick={() => copyUpiPhone(ownerUpiPhone)} className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-700 transition">Copy Phone</button>
                </div>
              </div>
            )}
            <div className="border-t pt-4 mt-2">
              <div><label className="block text-sm font-semibold mb-1">UPI Transaction ID (optional)</label><input type="text" className="w-full px-4 py-3 border rounded-xl" value={paymentTransactionId} onChange={e => setPaymentTransactionId(e.target.value)} /></div>
              <div className="mt-3"><label className="block text-sm font-semibold mb-1">Payment Screenshot *</label><input type="file" accept="image/*" onChange={e => { if (e.target.files[0]) setPaymentScreenshot(e.target.files[0]) }} className="w-full" /></div>
              <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 mt-3">After payment, upload the screenshot and submit. Owner will verify.</div>
              <button onClick={submitPaymentWithProof} disabled={paymentLoading || isSubmitting} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold mt-4 disabled:opacity-50">{paymentLoading ? 'Submitting...' : 'Submit Payment Proof'}</button>
              <button onClick={onCancel} className="w-full text-center text-gray-500 text-sm mt-3">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Owner has not set up UPI payment details. Please contact owner.</p>
        )}
      </motion.div>
    </div>
  )
}
