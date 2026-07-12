import { motion } from 'framer-motion'
import { formatCurrency } from '../../../lib/utils'
import { useModalAccessibility } from '../../../hooks/useModalAccessibility'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'

export default function PayRentModal({
  tenant = {},
  room = {},
  ownerUpiId = '',
  ownerUpiPhone = '',
  paymentTransactionId = '',
  setPaymentTransactionId = () => {},
  paymentScreenshot = null,
  setPaymentScreenshot = () => {},
  paymentLoading = false,
  isSubmitting = false,
  copyUpiId = () => {},
  copyUpiPhone = () => {},
  submitPaymentWithProof = () => {},
  onCancel = () => {},
}) {
  const amount = Number(tenant?.pending_amount ?? tenant?.rent_amount ?? 0)
  const busy = paymentLoading || isSubmitting
  const isDirty = Boolean(paymentTransactionId?.trim() || paymentScreenshot)
  const confirmDiscard = useUnsavedChangesGuard(isDirty && !busy)
  const requestCancel = () => { if (!busy && confirmDiscard()) onCancel() }
  const dialogRef = useModalAccessibility(requestCancel, busy)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4" onClick={requestCancel}>
      <motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pay-rent-modal-title" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-3">
          <h2 id="pay-rent-modal-title" className="text-base font-black leading-tight text-slate-900">Pay rent via UPI</h2>
          <button type="button" onClick={requestCancel} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close payment modal">&times;</button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <p className="text-sm font-semibold">{tenant?.name}</p>
          <p className="text-xs text-gray-500">Room {room?.room_number}</p>
          <p className="text-sm">Monthly Rent: {formatCurrency(tenant?.rent_amount)}</p>
          <p className="text-sm font-semibold text-red-500">Pending: {formatCurrency(amount)}</p>
        </div>
        {(ownerUpiId || ownerUpiPhone) ? (
          <div className="space-y-3">
            {ownerUpiId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-slate-900 dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100">
                <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Pay to UPI ID</p>
                <p className="mb-2 break-all font-mono text-sm">{ownerUpiId}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyUpiId(ownerUpiId)} className="h-8 rounded-full bg-gray-600 px-3 text-xs font-semibold text-white transition hover:bg-gray-700">Copy UPI ID</button>
                </div>
              </div>
            )}
            {ownerUpiPhone && (
              <div className="rounded-lg border border-emerald-200 bg-green-50 p-3 text-slate-900 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-100">
                <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Pay to UPI Phone Number</p>
                <p className="mb-2 break-all font-mono text-sm">{ownerUpiPhone}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copyUpiPhone(ownerUpiPhone)} className="h-8 rounded-full bg-gray-600 px-3 text-xs font-semibold text-white transition hover:bg-gray-700">Copy Phone</button>
                </div>
              </div>
            )}
            <div className="border-t pt-3">
              <div><label htmlFor="tenant-payment-transaction-id" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">UPI Transaction ID *</label><input id="tenant-payment-transaction-id" name="payment_transaction_id" type="text" required className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" value={paymentTransactionId} onChange={e => setPaymentTransactionId(e.target.value)} /></div>
              <div className="mt-2"><label htmlFor="tenant-payment-screenshot" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Payment Screenshot *</label><input id="tenant-payment-screenshot" name="payment_screenshot" type="file" accept="image/*" onChange={e => { if (e.target.files[0]) setPaymentScreenshot(e.target.files[0]) }} className="w-full text-sm text-slate-700 file:text-slate-700 dark:text-slate-200 dark:file:text-slate-200" />{paymentScreenshot?.name && <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-300">Selected: {paymentScreenshot.name}</p>}</div>
              <div className="mt-2 rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800">After payment, upload the screenshot and submit. Owner will verify.</div>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Owner has not set up UPI payment details. Please contact owner.</p>
        )}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-950">
          <button type="button" onClick={submitPaymentWithProof} disabled={paymentLoading || isSubmitting || !paymentScreenshot || !paymentTransactionId.trim()} className="h-9 flex-1 rounded-xl bg-slate-800 text-sm font-semibold text-white disabled:opacity-50">{paymentLoading ? 'Submitting...' : 'Submit proof'}</button>
          <button type="button" onClick={requestCancel} disabled={busy} className="h-9 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}
