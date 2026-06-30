# HostelSet

HostelSet is a Next.js and Supabase application for hostel owners, tenants and platform administrators.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase and optional Brevo values.
3. Apply the Supabase migrations with `npx supabase db push`, or run the SQL files in order in the Supabase SQL editor.
4. Start development with `npm run dev`.

## Required production environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `BREVO_API_KEY` when renewal emails are enabled

Never commit `.env.local` or production secrets.

The `process-rent-reminders` Supabase Edge Function requires its own Function
secrets: `BREVO_API_KEY`, `RENT_REMINDER_SCHEDULER_SECRET`, and the four
`BREVO_RENT_*_TEMPLATE_ID` values documented in
`supabase/functions/process-rent-reminders/README.md`.

## Payments and membership

- Tenant rent is paid directly to the owner's configured UPI ID or phone number. The tenant uploads a screenshot and the owner/admin confirms it.
- Owners request monthly or yearly membership. Requests appear in the admin dashboard in realtime and become active only after admin approval.
- No external payment gateway is used.

## Release checks

Run both commands before deployment:

```bash
npm run build
npm audit --omit=dev
```

The database migrations must be deployed before the matching application release.
