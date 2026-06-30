/**
 * Supabase types introduced by the rent reminder infrastructure migration.
 * Keep these in sync with 202606300002_rent_reminder_infrastructure.sql.
 */

export type RentRecordStatus = "unpaid" | "paid" | "cancelled";

export type RentReminderType =
  | "before_due"
  | "due_today"
  | "overdue_2_days"
  | "weekly_overdue";

export type RentReminderStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "dead_letter";

export interface RentRecordRow {
  id: string;
  tenant_id: string;
  owner_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  amount: number;
  status: RentRecordStatus;
  reminders_enabled: boolean;
  reminder_timezone: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentReminderQueueRow {
  id: string;
  tenant_id: string;
  owner_id: string;
  rent_id: string;
  reminder_type: RentReminderType;
  reminder_sequence: number;
  scheduled_at: string;
  status: RentReminderStatus;
  retry_count: number;
  max_retries: number;
  lock_token: string | null;
  locked_at: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentReminderSchedulerResult {
  materialized_rents: number;
  weekly_reminders_scheduled: number;
  stale_locks_recovered: number;
  stale_reminders_cancelled: number;
  ready_for_delivery: number;
}

export interface ClaimedRentReminder {
  id: string;
  tenant_id: string;
  owner_id: string;
  rent_id: string;
  reminder_type: RentReminderType;
  scheduled_at: string;
  retry_count: number;
  tenant_email: string | null;
  tenant_name: string | null;
  amount: number;
  due_date: string;
}

export interface PaymentHistoryRentReminderFields {
  rent_id: string | null;
}

export interface VisitorApplicationSecurityFields {
  payment_screenshot: string | null;
  payment_transaction_id: string | null;
  payment_amount: number;
}

export type RoomAudience = "boys" | "girls" | "coliving";

export interface RoomApplicationSettings {
  room_audience: RoomAudience;
  deposit_amount: number;
}

export interface ApprovalResult {
  success: boolean;
  tenant_id: string;
  email: string;
}

export type RentReminderTables = {
  rent_records: {
    Row: RentRecordRow;
    Insert: {
      id?: string;
      tenant_id: string;
      owner_id: string;
      period_start: string;
      period_end: string;
      due_date: string;
      amount: number;
      status?: RentRecordStatus;
      reminders_enabled?: boolean;
      reminder_timezone?: string;
      paid_at?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<RentRecordRow>;
  };
  rent_reminder_queue: {
    Row: RentReminderQueueRow;
    Insert: {
      id?: string;
      tenant_id: string;
      owner_id: string;
      rent_id: string;
      reminder_type: RentReminderType;
      reminder_sequence?: number;
      scheduled_at: string;
      status?: RentReminderStatus;
      retry_count?: number;
      max_retries?: number;
      lock_token?: string | null;
      locked_at?: string | null;
      last_attempt_at?: string | null;
      sent_at?: string | null;
      last_error?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<RentReminderQueueRow>;
  };
};

export type RentReminderFunctions = {
  approve_application_atomic: {
    Args: { p_application_id: string };
    Returns: ApprovalResult;
  };
  approve_prebooking_atomic: {
    Args: { p_booking_id: string; p_user_id: string };
    Returns: ApprovalResult;
  };
  run_rent_reminder_scheduler: {
    Args: { p_reference_time?: string };
    Returns: RentReminderSchedulerResult;
  };
  claim_due_rent_reminders: {
    Args: {
      p_lock_token: string;
      p_batch_size?: number;
      p_reference_time?: string;
    };
    Returns: ClaimedRentReminder[];
  };
  complete_rent_reminder: {
    Args: { p_reminder_id: string; p_lock_token: string };
    Returns: boolean;
  };
  fail_rent_reminder: {
    Args: { p_reminder_id: string; p_lock_token: string; p_error: string };
    Returns: RentReminderStatus;
  };
};
