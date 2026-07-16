import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.8";
import { createBrevoEmailService } from "../_shared/brevo-email-service.ts";
import { dryRunRentReminders } from "../_shared/rent-reminder-dry-run.ts";
import { RentReminderService } from "../_shared/rent-reminder-service.ts";
import { SupabaseRentReminderRepository } from "../_shared/supabase-rent-reminder-repository.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function authorized(request: Request): boolean {
  const schedulerSecret = Deno.env.get("RENT_REMINDER_SCHEDULER_SECRET");
  if (!schedulerSecret) return false;

  const schedulerHeader = request.headers.get("x-scheduler-secret");
  if (schedulerHeader) return schedulerHeader === schedulerSecret;

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${schedulerSecret}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({})) as {
    dryRun?: boolean;
    rentId?: string;
    tenantId?: string;
    limit?: number;
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      { error: "Supabase service credentials are not configured" },
      500,
    );
  }

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.dryRun) {
      const result = await dryRunRentReminders(client, {
        rentId: body.rentId,
        tenantId: body.tenantId,
        limit: body.limit,
        getEnvironmentValue: (name) => Deno.env.get(name),
      });
      return json(result, 200);
    }

    const repository = new SupabaseRentReminderRepository(client);

    const emailService = createBrevoEmailService((name) => Deno.env.get(name));
    const service = new RentReminderService(
      repository,
      emailService,
    );
    const result = await service.run();

    return json(result, result.deliveryEnabled ? 200 : 202);
  } catch (error) {
    console.error("Rent reminder scheduler failed", error);
    return json(
      {
        error: error instanceof Error
          ? error.message
          : "Unexpected scheduler error",
      },
      500,
    );
  }
});
