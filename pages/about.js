import PublicInfoPage from '../components/PublicInfoPage'

export default function About() {
  return (
    <PublicInfoPage
      title="About HostelSet"
      description="Learn how HostelSet helps people discover hostel and PG properties and manage their applications online."
      path="/about"
    >
      <p>HostelSet helps people discover participating hostel and PG properties, compare rooms and rent, review amenities and location details, and submit applications online.</p>
      <h2 className="text-xl font-semibold text-slate-900">For property owners</h2>
      <p>Owners can manage multiple properties, rooms, applications, tenants, rent and payment records, notices, complaints, room-change requests, and vacate workflows from one dashboard.</p>
      <h2 className="text-xl font-semibold text-slate-900">For tenants and applicants</h2>
      <p>Applicants can review public property information and apply for available accommodation. Approved tenants can use their dashboard to view rent information, submit payment proof, read notices, raise complaints, and manage eligible room-change or vacate requests.</p>
      <h2 className="text-xl font-semibold text-slate-900">Administration</h2>
      <p>HostelSet administrators manage platform memberships, owner access, and global notices. Property listing details, payment details, accommodation decisions, and tenant operations remain the responsibility of the relevant property owner.</p>
    </PublicInfoPage>
  )
}
