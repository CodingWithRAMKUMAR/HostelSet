import PublicInfoPage from '../components/PublicInfoPage'

export default function Contact() {
  return (
    <PublicInfoPage
      title="Contact"
      description="Find the right contact route for a HostelSet property, application, or account question."
      path="/contact"
    >
      <p>For questions about a room, rent, availability, or an existing application, use the public contact details shown on the relevant property listing. The property owner is responsible for confirming those details.</p>
      <p>Owners and tenants with an account should use their dashboard and the contact route supplied by their HostelSet administrator for account-specific assistance. Never share passwords or one-time codes.</p>
    </PublicInfoPage>
  )
}
