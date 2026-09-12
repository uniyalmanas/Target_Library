/**
 * Synthetic Demo Data for LibraryOS Interactive Demo Lounge
 * Provides realistic, safe, and dynamic sample records for prospective library owners.
 * Completely isolated from real customer accounts and operational databases.
 */

import { DEMO_LIBRARY_ID } from "./tenant";

export interface DemoMember {
  student_id: number;
  name: string;
  phone: string;
  aadhar_no: string;
  date_of_joining: string;
  library_id: string;
  receipts?: Array<{
    start_date: string;
    end_date: string;
    subscription_type: string;
    amount_paid: number;
    seats?: { seat_number: number };
  }>;
}

export interface DemoSeatReceipt {
  receipt_no: number;
  student_id: number;
  subscription_type: "full_day" | "half_day";
  shift_type: "shift_1" | "shift_2" | "shift_3" | "morning" | "evening" | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
  is_vacated?: boolean;
  is_overdue?: boolean;
  days_overdue?: number;
  member: {
    student_id: number;
    name: string;
    phone: string;
    aadhar_no?: string;
  };
}

export interface DemoSeat {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
  is_overdue?: boolean;
  has_due?: boolean;
  is_double_shift?: boolean;
  status?: string;
  receipts: DemoSeatReceipt[];
}

/**
 * Returns formatted IST date string (YYYY-MM-DD) with relative day offset
 */
export function getDemoISTDate(daysOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Generate 60 realistic seats for LibraryOS Demo Lounge
 */
export function getDemoSeats(): DemoSeat[] {
  const seats: DemoSeat[] = [];

  // Pre-configured profiles for key demo seats
  const profiles: Record<number, {
    type: "full" | "double" | "half" | "due" | "free";
    s1?: { name: string; phone: string; shift: "shift_1" | "shift_2" | "morning" | "evening" | null; daysOffsetStart: number; daysOffsetEnd: number; amount: number; hasSheet?: boolean; overdue?: boolean; daysOverdue?: number };
    s2?: { name: string; phone: string; shift: "shift_1" | "shift_2" | "morning" | "evening" | null; daysOffsetStart: number; daysOffsetEnd: number; amount: number; hasSheet?: boolean };
  }> = {
    1: { type: "full", s1: { name: "Rahul Sharma", phone: "98765 00001", shift: null, daysOffsetStart: -14, daysOffsetEnd: 16, amount: 900 } },
    2: {
      type: "double",
      s1: { name: "Amit Verma", phone: "98765 00002", shift: "shift_1", daysOffsetStart: -10, daysOffsetEnd: 20, amount: 600 },
      s2: { name: "Priya Malhotra", phone: "98765 00003", shift: "shift_2", daysOffsetStart: -8, daysOffsetEnd: 22, amount: 600 },
    },
    3: { type: "free" },
    4: { type: "half", s1: { name: "Sushil Das", phone: "98765 00004", shift: "shift_1", daysOffsetStart: -12, daysOffsetEnd: 18, amount: 600 } },
    5: { type: "due", s1: { name: "Neeraj Rawat", phone: "98765 00005", shift: null, daysOffsetStart: -33, daysOffsetEnd: -3, amount: 900, overdue: true, daysOverdue: 3 } },
    6: { type: "free" },
    7: { type: "full", s1: { name: "Mansi Joshi", phone: "98765 00006", shift: null, daysOffsetStart: -5, daysOffsetEnd: 25, amount: 900 } },
    8: {
      type: "double",
      s1: { name: "Vikas Chauhan", phone: "98765 00007", shift: "shift_1", daysOffsetStart: -15, daysOffsetEnd: 15, amount: 600 },
      s2: { name: "Ankit Panwar", phone: "98765 00008", shift: "shift_2", daysOffsetStart: -18, daysOffsetEnd: 12, amount: 600 },
    },
    9: { type: "free" },
    10: { type: "free" },
    11: { type: "half", s1: { name: "Rohan Kumar", phone: "98765 00009", shift: "shift_2", daysOffsetStart: -9, daysOffsetEnd: 21, amount: 600 } },
    12: { type: "full", s1: { name: "Kavita Negi", phone: "98765 00010", shift: null, daysOffsetStart: -16, daysOffsetEnd: 14, amount: 1200, hasSheet: true } },
    13: { type: "due", s1: { name: "Deepak Singh", phone: "98765 00011", shift: null, daysOffsetStart: -35, daysOffsetEnd: -5, amount: 900, overdue: true, daysOverdue: 5 } },
    14: { type: "free" },
    15: {
      type: "double",
      s1: { name: "Mohit Bhatt", phone: "98765 00012", shift: "shift_1", daysOffsetStart: -11, daysOffsetEnd: 19, amount: 600 },
      s2: { name: "Aarti Mehra", phone: "98765 00013", shift: "shift_2", daysOffsetStart: -7, daysOffsetEnd: 23, amount: 600 },
    },
    16: { type: "free" },
    17: { type: "full", s1: { name: "Alok Tiwari", phone: "98765 00014", shift: null, daysOffsetStart: -8, daysOffsetEnd: 22, amount: 900 } },
    18: { type: "free" },
    19: { type: "half", s1: { name: "Sonia Gandhi", phone: "98765 00015", shift: "shift_1", daysOffsetStart: -4, daysOffsetEnd: 26, amount: 600 } },
    20: { type: "free" },
    21: { type: "full", s1: { name: "Harish Bisht", phone: "98765 00016", shift: null, daysOffsetStart: -15, daysOffsetEnd: 15, amount: 900 } },
    22: {
      type: "double",
      s1: { name: "Pooja Gupta", phone: "98765 00017", shift: "shift_1", daysOffsetStart: -13, daysOffsetEnd: 17, amount: 600 },
      s2: { name: "Ritu Saini", phone: "98765 00018", shift: "shift_2", daysOffsetStart: -10, daysOffsetEnd: 20, amount: 600 },
    },
    23: { type: "free" },
    24: { type: "free" },
    25: { type: "full", s1: { name: "Vikram Rathore", phone: "98765 00019", shift: null, daysOffsetStart: -3, daysOffsetEnd: 27, amount: 900 } },
    26: { type: "full", s1: { name: "Ananya Reddy", phone: "98765 00020", shift: null, daysOffsetStart: -19, daysOffsetEnd: 11, amount: 1200, hasSheet: true } },
    27: { type: "half", s1: { name: "Kabir Mehta", phone: "98765 00021", shift: "shift_1", daysOffsetStart: -14, daysOffsetEnd: 16, amount: 600 } },
    28: { type: "due", s1: { name: "Sneha Kapoor", phone: "98765 00022", shift: null, daysOffsetStart: -38, daysOffsetEnd: -8, amount: 900, overdue: true, daysOverdue: 8 } },
    29: { type: "free" },
    30: {
      type: "double",
      s1: { name: "Tanmay Deshmukh", phone: "98765 00023", shift: "shift_1", daysOffsetStart: -14, daysOffsetEnd: 16, amount: 600 },
      s2: { name: "Divya Nambiar", phone: "98765 00024", shift: "shift_2", daysOffsetStart: -14, daysOffsetEnd: 16, amount: 600 },
    },
    31: { type: "full", s1: { name: "Nikhil Chawla", phone: "98765 00025", shift: null, daysOffsetStart: -6, daysOffsetEnd: 24, amount: 900 } },
    32: { type: "free" },
    33: { type: "full", s1: { name: "Aditi Sen", phone: "98765 00026", shift: null, daysOffsetStart: -12, daysOffsetEnd: 18, amount: 900 } },
    34: { type: "half", s1: { name: "Varun Nair", phone: "98765 00027", shift: "shift_2", daysOffsetStart: -11, daysOffsetEnd: 19, amount: 600 } },
    35: { type: "free" },
    36: {
      type: "double",
      s1: { name: "Karan Johar", phone: "98765 00028", shift: "shift_1", daysOffsetStart: -10, daysOffsetEnd: 20, amount: 600 },
      s2: { name: "Meera Sen", phone: "98765 00029", shift: "shift_2", daysOffsetStart: -10, daysOffsetEnd: 20, amount: 600 },
    },
    37: { type: "full", s1: { name: "Shweta Tiwari", phone: "98765 00030", shift: null, daysOffsetStart: -18, daysOffsetEnd: 12, amount: 900 } },
    38: { type: "free" },
    39: { type: "due", s1: { name: "Abhishek Roy", phone: "98765 00031", shift: null, daysOffsetStart: -32, daysOffsetEnd: -2, amount: 900, overdue: true, daysOverdue: 2 } },
    40: { type: "free" },
    41: { type: "full", s1: { name: "Gaurav Pandey", phone: "98765 00032", shift: null, daysOffsetStart: -10, daysOffsetEnd: 20, amount: 900 } },
    42: {
      type: "double",
      s1: { name: "Ishaan Khattar", phone: "98765 00033", shift: "shift_1", daysOffsetStart: -12, daysOffsetEnd: 18, amount: 600 },
      s2: { name: "Tara Sutaria", phone: "98765 00034", shift: "shift_2", daysOffsetStart: -12, daysOffsetEnd: 18, amount: 600 },
    },
    43: { type: "free" },
    44: { type: "half", s1: { name: "Prateek Kuhad", phone: "98765 00035", shift: "shift_1", daysOffsetStart: -5, daysOffsetEnd: 25, amount: 600 } },
    45: { type: "free" },
    46: { type: "full", s1: { name: "Jaspreet Kaur", phone: "98765 00036", shift: null, daysOffsetStart: -7, daysOffsetEnd: 23, amount: 900 } },
    47: { type: "free" },
    48: {
      type: "double",
      s1: { name: "Manish Paul", phone: "98765 00037", shift: "shift_1", daysOffsetStart: -15, daysOffsetEnd: 15, amount: 600 },
      s2: { name: "Riddhima Kapoor", phone: "98765 00038", shift: "shift_2", daysOffsetStart: -15, daysOffsetEnd: 15, amount: 600 },
    },
    49: { type: "free" },
    50: { type: "free" },
    51: { type: "full", s1: { name: "Siddharth Anand", phone: "98765 00039", shift: null, daysOffsetStart: -2, daysOffsetEnd: 28, amount: 900 } },
    52: { type: "free" },
    53: { type: "half", s1: { name: "Zoya Akhtar", phone: "98765 00040", shift: "shift_2", daysOffsetStart: -9, daysOffsetEnd: 21, amount: 600 } },
    54: { type: "free" },
    55: { type: "full", s1: { name: "Farhan Akhtar", phone: "98765 00041", shift: null, daysOffsetStart: -11, daysOffsetEnd: 19, amount: 900 } },
    56: { type: "free" },
    57: { type: "free" },
    58: { type: "full", s1: { name: "Kunal Khemu", phone: "98765 00042", shift: null, daysOffsetStart: -4, daysOffsetEnd: 26, amount: 900 } },
    59: { type: "free" },
    60: { type: "free" },
  };

  for (let i = 1; i <= 60; i++) {
    const prof = profiles[i] || { type: "free" };
    if (prof.type === "free" || !prof.s1) {
      seats.push({
        seat_id: i,
        seat_number: i,
        occupied: false,
        is_overdue: false,
        has_due: false,
        is_double_shift: false,
        status: "free",
        receipts: [],
      });
      continue;
    }

    const receipts: DemoSeatReceipt[] = [];

    // First student receipt
    receipts.push({
      receipt_no: 8000 + i * 2,
      student_id: 1000 + i * 2,
      subscription_type: prof.s1.shift ? "half_day" : "full_day",
      shift_type: prof.s1.shift,
      has_sheet: Boolean(prof.s1.hasSheet),
      amount_paid: prof.s1.amount,
      start_date: getDemoISTDate(prof.s1.daysOffsetStart),
      end_date: getDemoISTDate(prof.s1.daysOffsetEnd),
      is_vacated: false,
      is_overdue: Boolean(prof.s1.overdue),
      days_overdue: prof.s1.daysOverdue || 0,
      member: {
        student_id: 1000 + i * 2,
        name: prof.s1.name,
        phone: prof.s1.phone,
        aadhar_no: `XXXX-XXXX-${1000 + i}`,
      },
    });

    // Second student receipt for double shifts
    if (prof.s2) {
      receipts.push({
        receipt_no: 8000 + i * 2 + 1,
        student_id: 1000 + i * 2 + 1,
        subscription_type: "half_day",
        shift_type: prof.s2.shift,
        has_sheet: Boolean(prof.s2.hasSheet),
        amount_paid: prof.s2.amount,
        start_date: getDemoISTDate(prof.s2.daysOffsetStart),
        end_date: getDemoISTDate(prof.s2.daysOffsetEnd),
        is_vacated: false,
        is_overdue: false,
        days_overdue: 0,
        member: {
          student_id: 1000 + i * 2 + 1,
          name: prof.s2.name,
          phone: prof.s2.phone,
          aadhar_no: `XXXX-XXXX-${2000 + i}`,
        },
      });
    }

    let status = "occupied";
    if (prof.type === "due") status = "due";
    else if (prof.type === "double") status = "double_shift";
    else if (prof.type === "half") status = "half_day";
    else if (prof.type === "full") status = "full_day";

    seats.push({
      seat_id: i,
      seat_number: i,
      occupied: true,
      is_overdue: prof.type === "due",
      has_due: prof.type === "due",
      is_double_shift: prof.type === "double",
      status,
      receipts,
    });
  }

  return seats;
}

/**
 * Generate synthetic members for /members?slug=demo-library
 */
export function getDemoMembers(query?: string | null): DemoMember[] {
  const seats = getDemoSeats();
  const membersMap = new Map<number, DemoMember>();

  for (const s of seats) {
    for (const r of s.receipts) {
      if (!membersMap.has(r.student_id)) {
        membersMap.set(r.student_id, {
          student_id: r.student_id,
          name: r.member.name,
          phone: r.member.phone,
          aadhar_no: r.member.aadhar_no || "XXXX-XXXX-9999",
          date_of_joining: getDemoISTDate(-60),
          library_id: DEMO_LIBRARY_ID,
          receipts: [
            {
              start_date: r.start_date,
              end_date: r.end_date,
              subscription_type: r.subscription_type,
              amount_paid: r.amount_paid,
              seats: { seat_number: s.seat_number },
            },
          ],
        });
      }
    }
  }

  let list = Array.from(membersMap.values());
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        String(m.student_id).includes(q)
    );
  }

  return list;
}

/**
 * Generate synthetic daily collections for /collections?slug=demo-library
 */
export function getDemoCollections(targetDate?: string | null) {
  const today = getDemoISTDate(0);
  const isToday = !targetDate || targetDate === today;

  return {
    summary: {
      total_amount: isToday ? 4500 : 3600,
      total_count: isToday ? 5 : 4,
      cash_amount: isToday ? 1500 : 1200,
      cash_count: isToday ? 2 : 2,
      online_amount: isToday ? 3000 : 2400,
      online_count: isToday ? 3 : 2,
      full_day_count: isToday ? 3 : 2,
      half_day_count: isToday ? 2 : 2,
      new_admissions: isToday ? 2 : 1,
      renewals: isToday ? 3 : 3,
    },
    payments: [
      {
        receipt_no: 8901,
        student_id: 1001,
        seat_id: 1,
        seat_number: 1,
        student_name: "Rahul Sharma",
        phone: "98765 00001",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8902,
        student_id: 1002,
        seat_id: 2,
        seat_number: 2,
        student_name: "Amit Verma",
        phone: "98765 00002",
        subscription_type: "half_day",
        shift_type: "shift_1",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        payment_type: "new",
      },
      {
        receipt_no: 8903,
        student_id: 1010,
        seat_id: 12,
        seat_number: 12,
        student_name: "Kavita Negi",
        phone: "98765 00010",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: true,
        amount_paid: 1200,
        payment_mode: "cash",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8904,
        student_id: 1019,
        seat_id: 25,
        seat_number: 25,
        student_name: "Vikram Rathore",
        phone: "98765 00019",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
        payment_type: "new",
      },
      {
        receipt_no: 8905,
        student_id: 1009,
        seat_id: 11,
        seat_number: 11,
        student_name: "Rohan Kumar",
        phone: "98765 00009",
        subscription_type: "half_day",
        shift_type: "shift_2",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "cash",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 310 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
    ],
  };
}

/**
 * Generate synthetic due fees candidates for /due-fees?slug=demo-library
 */
export function getDemoDueFees() {
  return {
    summary: {
      total_due_count: 4,
      days_1_to_3: 2,
      days_4_to_7: 1,
      days_7_plus: 1,
      estimated_pending_fees: 3300,
    },
    candidates: [
      {
        receipt_no: 8501,
        student_id: 1005,
        name: "Neeraj Rawat",
        phone: "98765 00005",
        seat_id: 5,
        seat_number: 5,
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        start_date: getDemoISTDate(-33),
        end_date: getDemoISTDate(-3),
        days_overdue: 3,
        severity: "1_to_3_days",
      },
      {
        receipt_no: 8502,
        student_id: 1011,
        name: "Deepak Singh",
        phone: "98765 00011",
        seat_id: 13,
        seat_number: 13,
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        start_date: getDemoISTDate(-35),
        end_date: getDemoISTDate(-5),
        days_overdue: 5,
        severity: "4_to_7_days",
      },
      {
        receipt_no: 8503,
        student_id: 1022,
        name: "Sneha Kapoor",
        phone: "98765 00022",
        seat_id: 28,
        seat_number: 28,
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        start_date: getDemoISTDate(-38),
        end_date: getDemoISTDate(-8),
        days_overdue: 8,
        severity: "7_plus_days",
      },
      {
        receipt_no: 8504,
        student_id: 1031,
        name: "Abhishek Roy",
        phone: "98765 00031",
        seat_id: 39,
        seat_number: 39,
        subscription_type: "half_day",
        shift_type: "shift_1",
        has_sheet: false,
        amount_paid: 600,
        start_date: getDemoISTDate(-32),
        end_date: getDemoISTDate(-2),
        days_overdue: 2,
        severity: "1_to_3_days",
      },
    ],
  };
}

/**
 * Generate simulated incoming admission requests for /api/admission-requests?slug=demo-library
 */
export function getDemoAdmissionRequests() {
  return [
    {
      id: "demo-req-live-01",
      library_id: DEMO_LIBRARY_ID,
      student_name: "Arjun Kapoor",
      student_phone: "98765 00099",
      aadhar_no: "XXXX-XXXX-9999",
      subscription_type: "full_day",
      shift_type: null,
      has_sheet: true,
      amount_paid: 1200,
      payment_mode: "online",
      utr_number: "UPI-428910482012",
      status: "pending",
      created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
  ];
}
