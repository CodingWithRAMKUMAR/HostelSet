# Rent reminder worker

This Edge Function is the provider-independent delivery worker for queued rent
reminders. Email delivery is intentionally disabled: `UnconfiguredEmailService`
does not claim queue records or mark them as sent.

The database migration schedules rent creation and queue maintenance hourly via
Supabase Cron. Do not schedule this Edge Function for delivery until an approved
`EmailService` implementation replaces `UnconfiguredEmailService`.

When a provider is added:

1. Set `RENT_REMINDER_SCHEDULER_SECRET` as a Supabase Function secret.
2. Deploy with JWT verification disabled because the handler validates the
   dedicated scheduler bearer secret itself:
   `supabase functions deploy process-rent-reminders --no-verify-jwt`.
3. Invoke it hourly with `POST` and
   `Authorization: Bearer <RENT_REMINDER_SCHEDULER_SECRET>`.
4. Store scheduler credentials in Supabase Vault; never embed them in migration
   SQL or source control.

Template content is not stored in this function. A provider implementation must
resolve `templateKey` externally and honor `idempotencyKey`.
