type RentRecordForReminder = {
  id: string;
  tenant_id: string;
  owner_id: string;
  due_date: string;
  reminder_timezone?: string | null;
};

export type InitialReminderRepair = {
  tenant_id: string;
  owner_id: string;
  rent_id: string;
  reminder_type: "before_due" | "due_today";
  reminder_sequence: number;
  scheduled_at: string;
  status: "pending";
  retry_count: number;
  lock_token: null;
  locked_at: null;
  last_error: null;
  updated_at: string;
};

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const READY_INITIAL_TYPES = ["before_due", "due_today"] as const;

function partsFor(date: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

function offsetMsFor(date: Date, timeZone: string): number {
  const parts = partsFor(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function isoDateInZone(referenceTime: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = partsFor(referenceTime, timeZone);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function reminderTimeIso(
  dateIso: string,
  timeZone = DEFAULT_TIME_ZONE,
): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const localClockAsUtc = Date.UTC(year, month - 1, day, 9, 0, 0);
  const firstOffset = offsetMsFor(new Date(localClockAsUtc), timeZone);
  const secondOffset = offsetMsFor(
    new Date(localClockAsUtc - firstOffset),
    timeZone,
  );
  return new Date(localClockAsUtc - secondOffset).toISOString();
}

export function reminderRepairDueDates(
  referenceTime = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): { today: string; beforeDueDate: string } {
  const today = isoDateInZone(referenceTime, timeZone);
  return { today, beforeDueDate: addDays(today, 3) };
}

export function initialReminderRepairsForRents(
  rents: RentRecordForReminder[],
  referenceTime = new Date(),
): InitialReminderRepair[] {
  const now = referenceTime.toISOString();
  return rents.flatMap((rent) => {
    const timeZone = rent.reminder_timezone || DEFAULT_TIME_ZONE;
    const { today, beforeDueDate } = reminderRepairDueDates(referenceTime, timeZone);
    const repairs: InitialReminderRepair[] = [];
    if (rent.due_date === beforeDueDate) {
      repairs.push({
        tenant_id: rent.tenant_id,
        owner_id: rent.owner_id,
        rent_id: rent.id,
        reminder_type: "before_due",
        reminder_sequence: 0,
        scheduled_at: reminderTimeIso(addDays(rent.due_date, -3), timeZone),
        status: "pending",
        retry_count: 0,
        lock_token: null,
        locked_at: null,
        last_error: null,
        updated_at: now,
      });
    }
    if (rent.due_date === today) {
      repairs.push({
        tenant_id: rent.tenant_id,
        owner_id: rent.owner_id,
        rent_id: rent.id,
        reminder_type: "due_today",
        reminder_sequence: 0,
        scheduled_at: reminderTimeIso(rent.due_date, timeZone),
        status: "pending",
        retry_count: 0,
        lock_token: null,
        locked_at: null,
        last_error: null,
        updated_at: now,
      });
    }
    return repairs;
  });
}

export const repairableInitialReminderTypes = READY_INITIAL_TYPES;
