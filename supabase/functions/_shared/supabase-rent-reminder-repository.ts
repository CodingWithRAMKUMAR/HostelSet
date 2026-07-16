import type { SupabaseClient } from "npm:@supabase/supabase-js@2.39.8";
import type {
  ClaimedRentReminder,
  ReminderSchedulerResult,
  RentReminderRepository,
} from "./rent-reminder-types.ts";
import {
  initialReminderRepairsForRents,
  reminderRepairDueDates,
  repairableInitialReminderTypes,
} from "./rent-reminder-schedule.ts";

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
    await this.repairReadyInitialReminders();
    return data as ReminderSchedulerResult;
  }

  private async repairReadyInitialReminders(): Promise<number> {
    const referenceTime = new Date();
    const { today, beforeDueDate } = reminderRepairDueDates(referenceTime);
    const { data: rents, error: rentError } = await this.client
      .from("rent_records")
      .select("id,tenant_id,owner_id,due_date,reminder_timezone")
      .eq("status", "unpaid")
      .eq("reminders_enabled", true)
      .in("due_date", [today, beforeDueDate]);
    assertRpcSucceeded(rentError, "Unable to inspect ready rent reminders");

    const repairs = initialReminderRepairsForRents(rents ?? [], referenceTime);
    if (!repairs.length) return 0;

    const rentIds = [...new Set(repairs.map((repair) => repair.rent_id))];
    const { data: existingRows, error: existingError } = await this.client
      .from("rent_reminder_queue")
      .select("rent_id,reminder_type,reminder_sequence,status")
      .in("rent_id", rentIds)
      .in("reminder_type", [...repairableInitialReminderTypes])
      .eq("reminder_sequence", 0);
    assertRpcSucceeded(
      existingError,
      "Unable to inspect existing rent reminders",
    );

    const existingByKey = new Map(
      (existingRows ?? []).map((row) => [
        `${row.rent_id}:${row.reminder_type}:${row.reminder_sequence}`,
        row.status,
      ]),
    );
    const resettable = new Set(["pending", "failed", "cancelled"]);
    const rowsToUpsert = repairs.filter((repair) => {
      const key =
        `${repair.rent_id}:${repair.reminder_type}:${repair.reminder_sequence}`;
      const status = existingByKey.get(key);
      return !status || resettable.has(status);
    });
    if (!rowsToUpsert.length) return 0;

    const { error: upsertError } = await this.client
      .from("rent_reminder_queue")
      .upsert(rowsToUpsert, {
        onConflict: "rent_id,reminder_type,reminder_sequence",
      });
    assertRpcSucceeded(upsertError, "Unable to repair ready rent reminders");
    return rowsToUpsert.length;
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
