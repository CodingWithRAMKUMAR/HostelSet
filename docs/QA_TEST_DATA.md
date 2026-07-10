# HostelSet QA test data design

Use only fictional staging data. Do not seed real customer names, phone numbers, documents, payment proofs, or transaction references.

## Required test actors

Credentials must be supplied through an untracked local secret file or CI secret store, never committed.

| Actor | Role | Purpose |
| --- | --- | --- |
| QA Active Admin | `admin` | Admin dashboard, wrong-role checks, global search, membership actions |
| QA Inactive Admin | `admin`, inactive | inactive-admin denial test |
| QA Owner A | `owner` | Property A workflows |
| QA Owner B | `owner` | cross-property isolation target |
| QA Tenant A | `tenant` | Tenant under Owner A / Property A |
| QA Tenant B | `tenant` | Tenant under Owner B / Property B |
| QA Inactive Tenant | `tenant`, inactive | inactive/archived access denial |

Suggested fictional email pattern:

- `qa.admin.active@example.test`
- `qa.admin.inactive@example.test`
- `qa.owner.a@example.test`
- `qa.owner.b@example.test`
- `qa.tenant.a@example.test`
- `qa.tenant.b@example.test`
- `qa.tenant.inactive@example.test`

Suggested fictional phone range:

- Use reserved/test-only numbers documented by the QA team.
- Do not use real customer or team member numbers.

## Required fake properties

| Property | Owner | Purpose |
| --- | --- | --- |
| QA Jasmine House A | QA Owner A | normal Owner/Tenant workflows |
| QA Cedar House B | QA Owner B | cross-property isolation target |

## Required room data

For each property:

- available room
- partially occupied room
- full room

Example labels:

- `QA-A-101 Available`
- `QA-A-102 Partial`
- `QA-A-103 Full`
- `QA-B-201 Available`
- `QA-B-202 Partial`
- `QA-B-203 Full`

Use clearly fake rent/deposit amounts and ensure all generated records are tagged with QA metadata where the schema supports it.

## Required workflow records

Create these in staging only:

- pending application for Property A
- approved application if required by dashboard history
- pending pre-booking
- existing tenant import
- pending rent payment with fake proof
- confirmed payment
- rejected payment if supported
- payment-history record
- complaint
- room-change request
- vacate request
- Owner notice
- Admin/global notice if supported by current schema
- active membership request/status
- expired membership state if required by QA

## Fake files

Use generated non-sensitive files only:

- `qa-id-proof.pdf`
- `qa-profile-photo.png`
- `qa-payment-proof.png`

Files must contain visible `QA TEST DATA` text and no real IDs, faces, bank screenshots, UPI references, QR codes, or private documents.

## Repeatable seed approach

The seed process should be implemented as a server-only Node script after staging exists.

Safety requirements:

1. Refuse unless `HOSTELSET_ENV=staging`.
2. Refuse if `NEXT_PUBLIC_APP_ENV=production`.
3. Refuse unless `HOSTELSET_STAGING_PROJECT_REF` matches the connected Supabase project reference.
4. Refuse unless `HOSTELSET_ALLOW_STAGING_SEED=true`.
5. Require all test credentials from environment or an ignored local secret file.
6. Never print passwords, tokens, service keys, signed URLs, or private storage paths.
7. Use idempotent upserts where safe.
8. Label records with `QA` names/descriptions/status notes.
9. Avoid duplicate users/records.
10. Never run from `dev`, `build`, `start`, install, deploy, or postbuild scripts.

Auth users cannot be fully represented in SQL migrations. Create them through a guarded server-only seed script using Supabase Admin Auth only after the staging project is verified.

Current scripts:

- `npm run staging:check` validates staging identity only.
- `npm run staging:seed` validates staging identity and seed approval, then intentionally stops until real idempotent seed logic is implemented.
