import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import type {
  ClaimedRentReminder,
  ReminderSchedulerResult,
  RentReminderRepository,
} from "./rent-reminder-types.ts";

function assertRpcSucceeded(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

export class SupabaseRentReminderRepository implements RentReminderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async refreshSchedule(): Promise<ReminderSchedulerResult> {
    const { data, error } = await this.client.rpc(
      "run_rent_reminder_scheduler",
    );
    assertRpcSucceeded(error, "Unable to refresh rent reminder schedule");
    return data as ReminderSchedulerResult;
  }

  async claimDue(
    lockToken: string,
    batchSize: number,
  ): Promise<ClaimedRentReminder[]> {
    const { data, error } = await this.client.rpc("claim_due_rent_reminders", {
      p_lock_token: lockToken,
      p_batch_size: batchSize,
    });
    assertRpcSucceeded(error, "Unable to claim rent reminders");
    return (data ?? []) as ClaimedRentReminder[];
  }

  async complete(reminderId: string, lockToken: string): Promise<void> {
    const { data, error } = await this.client.rpc("complete_rent_reminder", {
      p_reminder_id: reminderId,
      p_lock_token: lockToken,
    });
    assertRpcSucceeded(error, "Unable to complete rent reminder");
    if (!data) throw new Error("Rent reminder lock was lost before completion");
  }

  async fail(
    reminderId: string,
    lockToken: string,
    reason: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("fail_rent_reminder", {
      p_reminder_id: reminderId,
      p_lock_token: lockToken,
      p_error: reason,
    });
    assertRpcSucceeded(error, "Unable to record rent reminder failure");
  }
}
