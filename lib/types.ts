export type SubscriptionType = "full_day" | "half_day";
export type ShiftType = "morning" | "evening" | null;

export interface Member {
  student_id: number;
  name: string;
  phone: string | null;
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
  start_date: string;
  end_date: string;
  created_at: string;
}

// Joined shape used for the seat grid
export interface SeatWithOccupant {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
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

export function toISODate(d: Date) {
  return d.toISOString().split("T")[0];
}
