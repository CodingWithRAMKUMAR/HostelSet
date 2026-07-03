import PublicInfoPage from '../components/PublicInfoPage'

export default function About() {
  return (
    <PublicInfoPage
      title="About HostelSet"
      description="Learn how HostelSet helps people discover hostel and PG properties and manage their applications online."
      path="/about"
    >
      <h2 className="text-xl font-semibold text-slate-900">What is HostelSet?</h2>
      <p>HostelSet is a hostel and PG discovery and management platform. It helps people review participating properties and helps property teams manage day-to-day accommodation workflows.</p>
      <h2 className="text-xl font-semibold text-slate-900">Who is HostelSet for?</h2>
      <p>HostelSet is designed for hostel and PG owners, administrators, applicants, and approved tenants.</p>
      <h2 className="text-xl font-semibold text-slate-900">How do hostel owners use it?</h2>
      <p>Owners can manage multiple properties, rooms, applications, tenants, rent and payment records, notices, complaints, room-change requests, and vacate workflows from one dashboard.</p>
      <h2 className="text-xl font-semibold text-slate-900">How do applicants and tenants use it?</h2>
      <p>Applicants can review public property information and apply for available accommodation. Approved tenants can use their dashboard to view rent information, submit payment proof, read notices, raise complaints, and manage eligible room-change or vacate requests.</p>
      <h2 className="text-xl font-semibold text-slate-900">Does HostelSet process payments?</h2>
      <p>No. HostelSet records payment information and proof, but UPI payments are made directly to the payment details supplied by the relevant property owner and are manually verified by that owner.</p>
      <h2 className="text-xl font-semibold text-slate-900">Administration</h2>
      <p>HostelSet administrators manage platform memberships, owner access, and global notices. Property listing details, payment details, accommodation decisions, and tenant operations remain the responsibility of the relevant property owner.</p>
    </PublicInfoPage>
  )
}
