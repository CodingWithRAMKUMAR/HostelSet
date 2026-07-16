import {
  initialReminderRepairsForRents,
  reminderRepairDueDates,
  reminderTimeIso,
} from "./rent-reminder-schedule.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("due-today uses the Asia/Kolkata local calendar date across UTC boundary", () => {
  const dates = reminderRepairDueDates(
    new Date("2026-07-15T20:00:00.000Z"),
    "Asia/Kolkata",
  );
  assert(dates.today === "2026-07-16", "Kolkata date should be July 16");
  assert(dates.beforeDueDate === "2026-07-19", "before due date is +3 days");
});

Deno.test("before-due and due-today repairs are scoped to ready unpaid cycles", () => {
  const rows = initialReminderRepairsForRents([
    {
      id: "rent-before",
      tenant_id: "tenant-1",
      owner_id: "owner-1",
      due_date: "2026-07-19",
      reminder_timezone: "Asia/Kolkata",
    },
    {
      id: "rent-today",
      tenant_id: "tenant-2",
      owner_id: "owner-1",
      due_date: "2026-07-16",
      reminder_timezone: "Asia/Kolkata",
    },
  ], new Date("2026-07-16T04:00:00.000Z"));

  assert(rows.length === 2, "one before-due and one due-today repair expected");
  assert(rows[0].reminder_type === "before_due", "first row is before due");
  assert(rows[1].reminder_type === "due_today", "second row is due today");
  assert(rows.every((row) => row.status === "pending"), "repairs stay pending");
  assert(rows.every((row) => row.retry_count === 0), "retry count resets safely");
});

Deno.test("reminder time is 09:00 in the selected timezone", () => {
  assert(
    reminderTimeIso("2026-07-16", "Asia/Kolkata") ===
      "2026-07-16T03:30:00.000Z",
    "09:00 IST is 03:30 UTC",
  );
});
