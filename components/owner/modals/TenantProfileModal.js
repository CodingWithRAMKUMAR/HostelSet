import { formatCurrency, formatDate, formatRentDueDetail } from '../../../lib/utils'
import { displayBloodGroup } from '../../../lib/bloodGroups'
import { useState } from 'react'

function DocumentItem({ label, record, field, onOpen }) {
  if (!record?.[field]) return null
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
      <button onClick={() => onOpen({ record, field })} className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">Open secure document</button>
    </div>
  )
}

const Detail = ({ label, value }) => value !== null && value !== undefined && value !== '' ? <p><strong>{label}:</strong> {value}</p> : null

export default function TenantProfileModal({ tenant, application, extraDocuments = [], loading, onClose, onViewScreenshot = () => {}, onProfilePhotoChange = () => {}, photoUpdating = false }) {
  const [failed, setFailed] = useState(false)
  const rentSummary = tenant?.rentSummary || tenant?.dueStatus || null
  const tenantPaymentProof = tenant?.payment_screenshot ? [{ label: 'Tenant Payment Proof', record: tenant, field: 'payment_screenshot' }] : []
  const applicationDocuments = application ? [
    { label: application.source_type === 'existing_tenant_import' ? 'Profile Photo' : 'Tenant Photo', record: application, field: 'photo' },
    { label: 'ID Proof / Aadhaar / PAN', record: application, field: 'id_proof' },
    { label: 'Payment Proof', record: application, field: 'payment_screenshot' },
  ] : []
  const documents = [
    ...applicationDocuments,
    ...tenantPaymentProof,
    ...(extraDocuments || []),
  ].filter((document, index, all) => document.record?.[document.field] && all.findIndex(item => item.record?.[item.field] === document.record?.[document.field]) === index)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Tenant Profile</h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600" aria-label="Close tenant profile">×</button>
        </div>
        {loading ? <div className="py-8 text-center">Loading...</div> : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              {tenant?.profilePhotoUrl && !failed ? <img src={tenant.profilePhotoUrl} alt={tenant?.name ? `${tenant.name} profile photo` : 'Tenant profile photo'} onError={() => setFailed(true)} className="h-32 w-32 rounded-full object-cover" /> : <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-200 text-4xl font-bold text-slate-500">{(tenant?.name?.charAt(0) || 'U').toUpperCase()}</div>}
              <label className="text-center text-sm font-semibold text-slate-700">
                <span className="mb-1 block">Profile photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onProfilePhotoChange} disabled={photoUpdating} className="block max-w-xs text-xs text-slate-700 file:mr-2 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-orange-700 disabled:opacity-60" />
                <span className="mt-1 block text-xs font-normal text-slate-500">JPEG, PNG, or WEBP under 5MB. Not an identity document.</span>
              </label>
              {photoUpdating && <p className="text-xs font-semibold text-orange-700">Saving photo...</p>}
            </div>

            <section className="border-t pt-4">
              <h3 className="mb-2 text-lg font-semibold">Full Tenant Details</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Detail label="Name" value={tenant?.name} />
                <Detail label="Phone" value={tenant?.phone} />
                <Detail label="Email" value={tenant?.email} />
                <Detail label="Blood group" value={displayBloodGroup(tenant?.blood_group)} />
                <Detail label="Status" value={tenant?.status} />
                <Detail label="Rent status" value={rentSummary?.label || tenant?.rent_status} />
                <Detail label={rentSummary?.status === 'paid' ? 'Next rent due' : 'Rent due'} value={rentSummary ? formatRentDueDetail(rentSummary, formatDate) : null} />
                <Detail label="Hostel joined date" value={formatDate(tenant?.move_in_date)} />
                <Detail label="Monthly rent" value={formatCurrency(tenant?.rent_amount)} />
                <Detail label="Total paid" value={formatCurrency(tenant?.total_paid || 0)} />
                <Detail label="Pending amount" value={formatCurrency(rentSummary?.dueAmount ?? tenant?.pending_amount ?? 0)} />
                <Detail label="Last payment" value={tenant?.last_payment_date ? formatDate(tenant.last_payment_date) : null} />
                <Detail label="Address" value={tenant?.address} />
                <Detail label="Guardian name" value={tenant?.guardian_name} />
                <Detail label="Guardian phone" value={tenant?.guardian_phone || tenant?.guardian_contact} />
                <Detail label="Notice period end" value={tenant?.notice_period_end ? formatDate(tenant.notice_period_end) : null} />
              </div>
            </section>

            {application && (
              <section className="border-t pt-4">
                <h3 className="mb-2 text-lg font-semibold">{application.source_type === 'pre_booking' ? 'Linked Pre-booking Details' : application.source_type === 'existing_tenant_import' ? 'Linked Import Details' : 'Linked Application Details'}</h3>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <Detail label="Applicant name" value={application.name} />
                  <Detail label="Applicant phone" value={application.phone} />
                  <Detail label="Applicant email" value={application.email} />
                  <Detail label="Blood group" value={displayBloodGroup(application.blood_group)} />
                  <Detail label="Status" value={application.status} />
                  <Detail label="Submitted" value={formatDate(application.created_at)} />
                  <Detail label="Processed" value={application.processed_at ? formatDate(application.processed_at) : null} />
                  <Detail label={application.source_type === 'existing_tenant_import' ? 'Hostel joined date' : 'Expected move-in'} value={formatDate(application.expected_move_in_date || application.expected_move_in)} />
                  <Detail label="Last paid rent due date" value={application.paid_through_date ? formatDate(application.paid_through_date) : null} />
                  <Detail label="Address" value={application.address} />
                  <Detail label="Guardian name" value={application.guardian_name} />
                  <Detail label="Guardian phone" value={application.guardian_phone || application.guardian_contact} />
                  <Detail label="Payment transaction" value={application.payment_transaction_id} />
                  <Detail label="Application amount" value={application.payment_amount != null ? formatCurrency(application.payment_amount) : null} />
                  <Detail label="Pre-booking fee" value={application.pre_booking_fee_amount != null ? formatCurrency(application.pre_booking_fee_amount) : null} />
                </div>
                {application.message && <p className="mt-3 text-sm"><strong>Message:</strong> {application.message}</p>}
              </section>
            )}

            <section className="border-t pt-4">
              <h3 className="mb-3 text-lg font-semibold">Documents</h3>
              {documents.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map(document => <DocumentItem key={document.label} {...document} onOpen={onViewScreenshot} />)}
                </div>
              ) : <p className="text-sm text-gray-500">No document uploaded.</p>}
            </section>

            <div className="flex justify-end"><button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-white">Close</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
