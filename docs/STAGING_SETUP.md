# HostelSet staging setup

This document describes how to prepare a separate staging environment for authenticated QA. Do not point staging or Vercel Preview at the production Supabase project.

## Required environments

- `local`: developer machine; can point at local Supabase or the staging Supabase project.
- `staging`: dedicated Supabase project containing only fictional QA data.
- `Vercel Preview`: must point at staging Supabase.
- `production`: production Supabase and production secrets only.

## Public environment variables

These are safe to expose to browser code by design:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_GEOAPIFY_API_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

## Server-only environment variables

These must exist only in local shell/server/Vercel server environments. Never expose these through `NEXT_PUBLIC_*`.

- `SUPABASE_SERVICE_ROLE_KEY`
- `API_RATE_LIMIT_SECRET`
- `BREVO_API_KEY`
- `BREVO_APPLICATION_APPROVED_TEMPLATE_ID`
- `SENTRY_DSN`
- `RENT_REMINDER_SCHEDULER_SECRET`
- `HOSTELSET_ENV`
- `HOSTELSET_STAGING_PROJECT_REF`
- `HOSTELSET_ALLOW_STAGING_SEED`

## Create a staging Supabase project

1. Create a new Supabase project with a clear name such as `hostelset-staging`.
2. Never reuse the production project reference.
3. Apply schema only through `supabase/migrations/**`.
4. Do not copy real user data.
5. Do not copy private documents, IDs, payment screenshots, or tenant proofs.
6. Configure Supabase Auth Site URL and Redirect URLs for staging/local:
   - `http://localhost:3000`
   - the Vercel Preview URL pattern used by the project
   - the staging app URL, if one exists
7. Configure private storage buckets through migrations/setup:
   - `tenant-documents`
   - `property-photos`
8. Configure Supabase Edge Function secrets separately for staging.
9. Configure scheduler/cron secrets separately for staging.
10. Configure Brevo/test email behavior safely.
11. Use only test recipient addresses. Do not send staging mail to real tenants or owners.

## Local environment switching

To point local development at staging, set `.env.local` with staging values:

```env
NEXT_PUBLIC_SUPABASE_URL=<STAGING_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<STAGING_SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<STAGING_SERVICE_ROLE_KEY>
API_RATE_LIMIT_SECRET=<STAGING_RATE_LIMIT_SECRET>
HOSTELSET_ENV=staging
HOSTELSET_STAGING_PROJECT_REF=<STAGING_PROJECT_REF>
HOSTELSET_ALLOW_STAGING_SEED=false
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_APP_URL=http://localhost:3000
BREVO_API_KEY=<STAGING_OR_TEST_BREVO_KEY>
BREVO_APPLICATION_APPROVED_TEMPLATE_ID=<STAGING_TEMPLATE_ID>
NEXT_PUBLIC_GEOAPIFY_API_KEY=<STAGING_GEOAPIFY_KEY>
```

Run:

```powershell
npm run staging:check
```

The check must pass before any staging-only seed or authenticated QA work.

## Vercel separation

- Production environment variables must point only to the production Supabase project.
- Preview environment variables must point only to the staging Supabase project.
- Preview must never receive production `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, scheduler secrets, or rate-limit secrets.
- Keep Vercel Preview Auth redirect URLs registered in the staging Supabase project, not production.

## Supabase CLI notes

The local `supabase/config.toml` currently has `project_id = "hostelset"`, which is a local CLI label and not proof of a remote staging project.

Do not run destructive commands such as remote reset against a linked project. Apply migrations to a newly created staging project only after reviewing migration output.
