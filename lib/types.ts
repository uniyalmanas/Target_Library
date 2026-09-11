export type SubscriptionType = "full_day" | "half_day";
export type ShiftType = "morning" | "evening" | null;

export interface Member {
  student_id: number;
  name: string;
  phone: string | null;
  aadhar_no?: string | null;
  date_of_joining: string;
  created_at: string;
}

export interface Seat {
  seat_id: number;
  seat_number: number;
}

export interface Receipt {
  receipt_no: number;
  student_id: number;
  seat_id: number;
  subscription_type: SubscriptionType;
  shift_type: ShiftType;
  has_sheet: boolean;
  amount_paid: number;
  payment_mode?: "cash" | "online";
  start_date: string;
  end_date: string;
  is_vacated?: boolean;
  created_at: string;
}

// Joined shape used for the seat grid
export interface SeatWithOccupant {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
  is_overdue?: boolean;
  is_double_shift?: boolean;
  status?: string;
  receipt?: Receipt;
  member?: Member;
}

// Pricing table — single source of truth for suggested amounts
export const PRICING = {
  full_day: { base: 900, with_sheet: 1200 },
  half_day: { base: 600, with_sheet: 900 },
} as const;

export function suggestedAmount(type: SubscriptionType, hasSheet: boolean) {
  return hasSheet ? PRICING[type].with_sheet : PRICING[type].base;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Multi-Tenant SaaS Types
export interface ShiftConfig {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  base_price: number;
  sheet_price: number;
}

export interface Library {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  upi_id: string | null;
  upi_name: string | null;
  monthly_fee: number;
  discount_code: string | null;
  is_lifetime_fixed: boolean;
  subscription_status: "trial" | "active" | "past_due" | "suspended";
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibrarySettings {
  library_id: string;
  total_seats: number;
  shifts_config: ShiftConfig[];
  has_sheet_enabled: boolean;
  sheet_price_monthly: number;
  require_aadhar: boolean;
  allow_student_self_registration: boolean;
  updated_at: string;
}

export interface LibraryUser {
  id: string;
  library_id: string;
  username: string;
  role: "owner" | "staff";
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdmissionRequest {
  id: string;
  library_id: string;
  student_name: string;
  student_phone: string;
  aadhar_no?: string | null;
  subscription_type: "full_day" | "half_day";
  shift_type: string | null;
  has_sheet: boolean;
  amount_paid: number;
  payment_mode: "online" | "cash";
  utr_number?: string | null;
  status: "pending" | "approved" | "rejected";
  assigned_seat_id?: number | null;
  assigned_receipt_no?: number | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}
