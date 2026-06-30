# Rent reminder worker

This Edge Function is the provider-independent delivery worker for queued rent
reminders. The active provider adapter uses Brevo transactional templates; the
reminder processor itself remains independent of Brevo.

The database migration schedules rent creation and queue maintenance hourly via
Supabase Cron. The delivery worker must also be invoked hourly after its secrets
and templates are configured.

Required Supabase Function secrets:

1. `BREVO_API_KEY`
2. `BREVO_RENT_BEFORE_DUE_TEMPLATE_ID`
3. `BREVO_RENT_DUE_TODAY_TEMPLATE_ID`
4. `BREVO_RENT_OVERDUE_2_DAYS_TEMPLATE_ID`
5. `BREVO_RENT_WEEKLY_OVERDUE_TEMPLATE_ID`
6. `RENT_REMINDER_SCHEDULER_SECRET`

All four template IDs must be positive integers. Delivery stays disabled if any
required setting is absent, so a partially configured deployment cannot consume
queue records.

Deployment:

1. Deploy with JWT verification disabled because the handler validates the
   dedicated scheduler bearer secret itself:
   `supabase functions deploy process-rent-reminders --no-verify-jwt`.
2. Invoke it hourly with `POST` and
   `X-Scheduler-Secret: <RENT_REMINDER_SCHEDULER_SECRET>`. Bearer authorization
   is also supported, but the dedicated header avoids collisions with Supabase
   Dashboard test-role authorization.
3. Store scheduler credentials in Supabase Vault; never embed them in migration
   SQL or source control.

Template content is not stored in this function. Brevo templates can use these
New Template Language values:

- `{{params.tenantName}}`
- `{{params.amount}}`
- `{{params.dueDate}}`
- `{{params.reminderType}}`
- `{{params.tenantId}}`, `{{params.ownerId}}`, and `{{params.rentId}}`

The queue ID is passed to Brevo as the idempotency key to prevent duplicate
delivery if the provider accepts a request but the worker loses its database
connection before recording success.
