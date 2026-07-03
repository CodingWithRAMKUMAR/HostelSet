import PublicInfoPage from '../components/PublicInfoPage'

export default function RefundPolicy() {
  return <PublicInfoPage title="Refund Policy" description="Understand how payment and refund requests are handled between HostelSet users and property owners." path="/refund-policy">
    <p className="text-sm text-slate-500">Effective 30 June 2026</p>
    <p>HostelSet does not directly process or hold tenant, rent, application, security-deposit, or pre-booking payments. Payments are made directly to the relevant hostel or property owner.</p>
    <h2 className="text-xl font-semibold text-slate-900">Owner refund policies</h2>
    <p>Whether an application or security deposit is refundable depends on the hostel or owner’s displayed policy, the property agreement, and applicable law. Refund requests must be reviewed and, where approved, issued by the recipient property owner.</p>
    <h2 className="text-xl font-semibold text-slate-900">Non-refundable amounts</h2>
    <p>Any non-refundable application, security, or pre-booking amount must be clearly shown before submission. Review the displayed wording and property terms before paying.</p>
    <h2 className="text-xl font-semibold text-slate-900">Payment evidence</h2>
    <p>Keep the UPI transaction reference, payment screenshot, and relevant communication when raising a payment or refund discrepancy with the property owner.</p>
  </PublicInfoPage>
}
