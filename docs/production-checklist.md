# HostelSet Production Deployment Checklist

## Vercel

- [ ] Production branch and build command (`npm run build`) are correct.
- [ ] Node.js 24.x is selected.
- [ ] Every required environment variable is configured for Production and Preview as appropriate.
- [ ] Deployment logs contain no build errors or secret values.
- [ ] Functions have suitable duration and regional settings for the expected users.

## Supabase

- [ ] Production project URL and anon key match the intended project.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` exists only in server/Function environments.
- [ ] All repository migrations are applied in order and migration history is clean.
- [ ] RLS, storage policies, scheduled jobs, and required extensions are enabled.
- [ ] Auth Site URL is `https://hostelset.com` and permitted redirect URLs include the production reset-password route.
- [ ] Rent-reminder Edge Function is deployed with JWT/settings matching the documented scheduler design.
- [ ] Realtime is enabled only for required tables.

## Brevo

- [ ] Sender domain and sender identity are verified.
- [ ] Production `BREVO_API_KEY` is current and has minimum required permissions.
- [ ] Approval and rent-reminder template IDs point to published templates.
- [ ] Test delivery, bounce handling, and spam-folder behavior.
- [ ] Rotate any API key that has appeared in screenshots, chat, logs, commits, or shared files.

## Domain and SSL

- [ ] `hostelset.com` and the chosen `www` behavior resolve to Vercel.
- [ ] HTTPS certificate is valid and automatic renewal is active.
- [ ] HTTP redirects to HTTPS and the canonical hostname is consistent.
- [ ] Security headers are present on production responses.

## Search and sitemap

- [ ] `NEXT_PUBLIC_APP_URL=https://hostelset.com` is set before building.
- [ ] `/robots.txt` is publicly reachable and references `/sitemap.xml`.
- [ ] `/sitemap.xml` contains active public properties and no protected routes.
- [ ] Submit the sitemap in Google Search Console and verify domain ownership.
- [ ] Test homepage and property structured data with Google Rich Results Test.

## Analytics and monitoring

- [ ] Configure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` if Sentry reporting is desired.
- [ ] Configure `NEXT_PUBLIC_GA_MEASUREMENT_ID` if GA4 is approved.
- [ ] Configure `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` if PostHog is approved.
- [ ] Verify privacy/legal wording reflects the analytics actually enabled.
- [ ] Trigger a controlled staging error and confirm monitoring receives a redacted event.
- [ ] Configure uptime checks for homepage, login, sitemap, and critical APIs.

## Backups and recovery

- [ ] Supabase production backups and point-in-time recovery meet the required retention target.
- [ ] Document who can restore data and test a restore outside production.
- [ ] Export or retain Brevo templates and critical environment configuration securely.
- [ ] Define recovery-time and recovery-point objectives.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `API_RATE_LIMIT_SECRET` (server only, at least 32 random characters)
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_ENV`
- `BREVO_API_KEY` (server only)
- `BREVO_APPLICATION_APPROVED_TEMPLATE_ID`
- `NEXT_PUBLIC_GEOAPIFY_API_KEY`

Optional monitoring variables are listed in `.env.example`.

## Supabase Edge Function secrets

- `BREVO_API_KEY`
- `RENT_REMINDER_SCHEDULER_SECRET`
- `BREVO_RENT_BEFORE_DUE_TEMPLATE_ID`
- `BREVO_RENT_DUE_TODAY_TEMPLATE_ID`
- `BREVO_RENT_OVERDUE_2_DAYS_TEMPLATE_ID`
- `BREVO_RENT_WEEKLY_OVERDUE_TEMPLATE_ID`

Never prefix private secrets with `NEXT_PUBLIC_`.
