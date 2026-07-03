import PublicInfoPage from '../components/PublicInfoPage'

export default function Support() {
  return (
    <PublicInfoPage
      title="HostelSet Support"
      description="Guidance for HostelSet applicants, tenants, and property owners."
      path="/support"
    >
      <h2 className="text-xl font-semibold text-slate-900">Applicants</h2>
      <p>Review the property, room, deposit, and payment instructions carefully before applying. Keep your transaction reference and payment proof. The property owner reviews submitted applications.</p>
      <h2 className="text-xl font-semibold text-slate-900">Tenants</h2>
      <p>Use the tenant dashboard to review rent, upload payment proof, read notices, raise complaints, and submit room-change or vacate requests where eligible.</p>
      <h2 className="text-xl font-semibold text-slate-900">Property owners</h2>
      <p>Use the owner dashboard to maintain listing details, rooms, applications, tenants, payments, notices, and requests. Confirm payment evidence before approving a transaction.</p>
    </PublicInfoPage>
  )
}
