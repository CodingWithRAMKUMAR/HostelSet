import PublicInfoPage from '../components/PublicInfoPage'

export default function Terms() {
  return <PublicInfoPage title="Terms of Service" description="Read the terms governing property listings, applications, tenancy management, and payment records on HostelSet." path="/terms">
    <p className="text-sm text-slate-500">Effective 30 June 2026</p>
    <p>HostelSet is a hostel and PG discovery and management platform. It provides tools for owners, applicants, tenants, and administrators, but submitting an application does not guarantee accommodation.</p>
    <h2 className="text-xl font-semibold text-slate-900">Owner responsibilities</h2>
    <p>Property owners are responsible for the accuracy of property details, availability, rent, deposits, rules, approvals, UPI or other payment details, and all decisions concerning their property and tenants.</p>
    <h2 className="text-xl font-semibold text-slate-900">Applicant and tenant responsibilities</h2>
    <p>Applicants and tenants must provide truthful, current details and lawful documents. Fake payment proof, incorrect transaction references, impersonation, or false documents may result in rejection, account action, or reporting to appropriate legal or cybercrime authorities.</p>
    <h2 className="text-xl font-semibold text-slate-900">Payments and deposits</h2>
    <p>HostelSet does not directly process or hold UPI payments. Payments are made to the payment details supplied by the property owner and are manually verified. Users should verify the recipient and retain their transaction reference and proof.</p>
    <p>Room rent is separate from an application or security deposit unless the property listing or owner agreement clearly states otherwise.</p>
    <h2 className="text-xl font-semibold text-slate-900">Acceptable use</h2>
    <p>Users must not misuse the service, access another user’s information without permission, interfere with security, upload unlawful material, or use HostelSet for fraudulent activity.</p>
  </PublicInfoPage>
}
