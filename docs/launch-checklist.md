# HostelSet Launch Checklist

## Technical checks

- [ ] `npm install`, lint/type checks included by the project, and `npm run build` succeed from a clean checkout.
- [ ] Run smoke tests for visitor, admin, owner, and tenant journeys on the production deployment.
- [ ] Verify desktop and mobile layouts in current Chrome, Edge, Safari, and Firefox.
- [ ] Verify login, logout, refresh, expired session, password setup, and password recovery.
- [ ] Verify property application, signed document upload, approval, and tenant access.
- [ ] Verify rent proof, approval/rejection, reminders, complaints, notices, room change, and vacate workflows.
- [ ] Verify realtime updates using two separate browser sessions.
- [ ] Verify rate limits and friendly timeout/offline behavior.
- [ ] Confirm private storage files cannot be opened without authorization or a valid signed URL.
- [ ] Confirm monitoring events contain no passwords, tokens, cookies, identity documents, or payment proof.

## Business checks

- [ ] Property, room, rent, deposit, refund, UPI, and contact information is accurate.
- [ ] Owner memberships, plans, renewal wording, and expiry handling are approved.
- [ ] Brevo sender details and all email copy are approved.
- [ ] Support ownership, escalation contacts, and incident authority are assigned.
- [ ] Privacy Policy, Terms, and Refund Policy have been reviewed for the operating jurisdiction.
- [ ] Backup retention, deletion requests, and record-retention responsibilities are documented.

## Marketing checks

- [ ] Production logo, favicon, PWA icons, title, descriptions, and social preview image are correct.
- [ ] Search Console ownership and sitemap submission are complete.
- [ ] Public property descriptions, photos, locations, amenities, and alt text are accurate.
- [ ] Analytics consent and disclosure requirements are satisfied before enabling GA4 or PostHog.
- [ ] Remove unsupported claims, placeholder statistics, links, and contact information.

## Support readiness

- [ ] `support@hostelset.com` and `contact@hostelset.com` receive mail and are monitored.
- [ ] Expected 24–48 business-hour response target is staffed.
- [ ] Support has procedures for login, application, payment-proof, owner approval, rent, complaint, room-change, and vacate issues.
- [ ] Define severity levels and an incident communication template.
- [ ] Document how to suspend a compromised account or rotate exposed credentials.
- [ ] Prepare a rollback owner and verify the previous stable Vercel deployment can be restored.
