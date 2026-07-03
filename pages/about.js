import PublicInfoPage from '../components/PublicInfoPage'

export default function About() {
  return (
    <PublicInfoPage
      title="About HostelSet"
      description="Learn how HostelSet helps people discover hostel and PG properties and manage their applications online."
      path="/about"
    >
      <p>HostelSet helps visitors browse participating hostel and PG properties, compare available rooms and rent, view amenities and location details, and submit an application online.</p>
      <p>Property owners use HostelSet to manage their property information, rooms, applications, tenants, notices, complaints, and rent records. Listing details and application decisions are provided by the relevant property owner.</p>
    </PublicInfoPage>
  )
}
