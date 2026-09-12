/**
 * Synthetic Demo Data for LibraryOS Interactive Demo Lounge
 * Scaled to 200 Seats capacity with realistic, safe, and dynamic sample records.
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

const FIRST_NAMES = [
  "Rahul", "Priya", "Amit", "Sneha", "Aarav", "Ananya", "Rohan", "Mansi",
  "Vikram", "Kavita", "Sushil", "Neeraj", "Vikas", "Ankit", "Aarti", "Mohit",
  "Alok", "Sonia", "Harish", "Pooja", "Ritu", "Kabir", "Tanmay", "Divya",
  "Nikhil", "Aditi", "Varun", "Karan", "Meera", "Shweta", "Abhishek", "Gaurav",
  "Ishaan", "Tara", "Prateek", "Jaspreet", "Manish", "Riddhima", "Siddharth",
  "Zoya", "Farhan", "Kunal", "Deepak", "Rajat", "Simran", "Chetan", "Bhavna",
  "Kailash", "Nandini", "Yash", "Monika", "Sachin", "Swati", "Tushar", "Preeti",
  "Umesh", "Deepika", "Kartik", "Komal", "Lalit", "Shalini", "Arnav", "Poonam"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Singh", "Gupta", "Malhotra", "Joshi", "Das",
  "Rawat", "Chauhan", "Panwar", "Mehra", "Bhatt", "Tiwari", "Gandhi", "Bisht",
  "Saini", "Rathore", "Reddy", "Mehta", "Deshmukh", "Nambiar", "Chawla", "Sen",
  "Nair", "Johar", "Roy", "Pandey", "Khattar", "Sutaria", "Kuhad", "Kaur",
  "Paul", "Kapoor", "Anand", "Akhtar", "Khemu", "Negi", "Mishra", "Dubey",
  "Yadav", "Tripathi", "Shukla", "Agrawal", "Bansal", "Bhatia", "Saxena", "Chopra"
];

function getDemoStudentName(seed: number): string {
  const f = FIRST_NAMES[seed % FIRST_NAMES.length];
  const l = LAST_NAMES[(seed * 3 + 7) % LAST_NAMES.length];
  return `${f} ${l}`;
}

/**
 * Generate 200 realistic seats for LibraryOS Demo Lounge
 */
export function getDemoSeats(): DemoSeat[] {
  const seats: DemoSeat[] = [];

  for (let i = 1; i <= 200; i++) {
    // Determine seat category procedurally for a natural, rich 200-seat matrix
    let category: "free" | "double" | "due" | "half" | "full";

    if (i % 13 === 5 || i === 13 || i === 28 || i === 39) {
      category = "due";
    } else if (i % 6 === 2) {
      category = "double";
    } else if (i % 6 === 4) {
      category = "half";
    } else if (i % 5 === 0 || i % 7 === 3) {
      category = "free";
    } else {
      category = "full";
    }

    if (category === "free") {
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
    const student1Id = 1000 + i * 2;
    const phoneNum1 = `98765 ${String(student1Id % 10000).padStart(5, "0")}`;
    const name1 = getDemoStudentName(i);
    const hasSheet = i % 4 === 0;

    if (category === "due") {
      const daysOverdue = (i % 7) + 2; // 2 to 8 days overdue
      receipts.push({
        receipt_no: 8000 + i * 2,
        student_id: student1Id,
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: hasSheet,
        amount_paid: hasSheet ? 1200 : 900,
        start_date: getDemoISTDate(-30 - daysOverdue),
        end_date: getDemoISTDate(-daysOverdue),
        is_vacated: false,
        is_overdue: true,
        days_overdue: daysOverdue,
        member: {
          student_id: student1Id,
          name: name1,
          phone: phoneNum1,
          aadhar_no: `XXXX-XXXX-${1000 + i}`,
        },
      });

      seats.push({
        seat_id: i,
        seat_number: i,
        occupied: true,
        is_overdue: true,
        has_due: true,
        is_double_shift: false,
        status: "due",
        receipts,
      });
      continue;
    }

    if (category === "double") {
      // Morning Shift Student (Shift 1)
      receipts.push({
        receipt_no: 8000 + i * 2,
        student_id: student1Id,
        subscription_type: "half_day",
        shift_type: "shift_1",
        has_sheet: false,
        amount_paid: 600,
        start_date: getDemoISTDate(-10 - (i % 10)),
        end_date: getDemoISTDate(20 - (i % 10)),
        is_vacated: false,
        is_overdue: false,
        days_overdue: 0,
        member: {
          student_id: student1Id,
          name: name1,
          phone: phoneNum1,
          aadhar_no: `XXXX-XXXX-${1000 + i}`,
        },
      });

      // Evening Shift Student (Shift 2)
      const student2Id = 1000 + i * 2 + 1;
      const phoneNum2 = `98765 ${String(student2Id % 10000).padStart(5, "0")}`;
      const name2 = getDemoStudentName(i + 100);

      receipts.push({
        receipt_no: 8000 + i * 2 + 1,
        student_id: student2Id,
        subscription_type: "half_day",
        shift_type: "shift_2",
        has_sheet: false,
        amount_paid: 600,
        start_date: getDemoISTDate(-8 - (i % 8)),
        end_date: getDemoISTDate(22 - (i % 8)),
        is_vacated: false,
        is_overdue: false,
        days_overdue: 0,
        member: {
          student_id: student2Id,
          name: name2,
          phone: phoneNum2,
          aadhar_no: `XXXX-XXXX-${2000 + i}`,
        },
      });

      seats.push({
        seat_id: i,
        seat_number: i,
        occupied: true,
        is_overdue: false,
        has_due: false,
        is_double_shift: true,
        status: "double_shift",
        receipts,
      });
      continue;
    }

    if (category === "half") {
      const shiftType = i % 2 === 0 ? "shift_1" : "shift_2";
      receipts.push({
        receipt_no: 8000 + i * 2,
        student_id: student1Id,
        subscription_type: "half_day",
        shift_type: shiftType,
        has_sheet: false,
        amount_paid: 600,
        start_date: getDemoISTDate(-12 - (i % 6)),
        end_date: getDemoISTDate(18 - (i % 6)),
        is_vacated: false,
        is_overdue: false,
        days_overdue: 0,
        member: {
          student_id: student1Id,
          name: name1,
          phone: phoneNum1,
          aadhar_no: `XXXX-XXXX-${1000 + i}`,
        },
      });

      seats.push({
        seat_id: i,
        seat_number: i,
        occupied: true,
        is_overdue: false,
        has_due: false,
        is_double_shift: false,
        status: "half_day",
        receipts,
      });
      continue;
    }

    // Default: Full Day
    receipts.push({
      receipt_no: 8000 + i * 2,
      student_id: student1Id,
      subscription_type: "full_day",
      shift_type: null,
      has_sheet: hasSheet,
      amount_paid: hasSheet ? 1200 : 900,
      start_date: getDemoISTDate(-14 - (i % 10)),
      end_date: getDemoISTDate(16 - (i % 10)),
      is_vacated: false,
      is_overdue: false,
      days_overdue: 0,
      member: {
        student_id: student1Id,
        name: name1,
        phone: phoneNum1,
        aadhar_no: `XXXX-XXXX-${1000 + i}`,
      },
    });

    seats.push({
      seat_id: i,
      seat_number: i,
      occupied: true,
      is_overdue: false,
      has_due: false,
      is_double_shift: false,
      status: "full_day",
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
          date_of_joining: getDemoISTDate(-60 - (r.student_id % 30)),
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
      total_amount: isToday ? 18600 : 15300,
      total_count: isToday ? 22 : 18,
      cash_amount: isToday ? 5400 : 4200,
      cash_count: isToday ? 6 : 5,
      online_amount: isToday ? 13200 : 11100,
      online_count: isToday ? 16 : 13,
      full_day_count: isToday ? 12 : 10,
      half_day_count: isToday ? 10 : 8,
      new_admissions: isToday ? 6 : 4,
      renewals: isToday ? 16 : 14,
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
        created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8902,
        student_id: 1004,
        seat_id: 2,
        seat_number: 2,
        student_name: "Amit Verma",
        phone: "98765 00004",
        subscription_type: "half_day",
        shift_type: "shift_1",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
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
        created_at: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8904,
        student_id: 1050,
        seat_id: 25,
        seat_number: 25,
        student_name: "Vikram Rathore",
        phone: "98765 00050",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
        payment_type: "new",
      },
      {
        receipt_no: 8905,
        student_id: 1022,
        seat_id: 11,
        seat_number: 11,
        student_name: "Rohan Kumar",
        phone: "98765 00022",
        subscription_type: "half_day",
        shift_type: "shift_2",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "cash",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 195 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8906,
        student_id: 1144,
        seat_id: 72,
        seat_number: 72,
        student_name: "Pooja Gupta",
        phone: "98765 00144",
        subscription_type: "half_day",
        shift_type: "shift_1",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8907,
        student_id: 1196,
        seat_id: 98,
        seat_number: 98,
        student_name: "Nikhil Chawla",
        phone: "98765 00196",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 310 * 60 * 1000).toISOString(),
        payment_type: "new",
      },
      {
        receipt_no: 8908,
        student_id: 1240,
        seat_id: 120,
        seat_number: 120,
        student_name: "Jaspreet Kaur",
        phone: "98765 00240",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: true,
        amount_paid: 1200,
        payment_mode: "cash",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 380 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8909,
        student_id: 1312,
        seat_id: 156,
        seat_number: 156,
        student_name: "Farhan Akhtar",
        phone: "98765 00312",
        subscription_type: "half_day",
        shift_type: "shift_2",
        has_sheet: false,
        amount_paid: 600,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 440 * 60 * 1000).toISOString(),
        payment_type: "renewal",
      },
      {
        receipt_no: 8910,
        student_id: 1378,
        seat_id: 189,
        seat_number: 189,
        student_name: "Siddharth Anand",
        phone: "98765 00378",
        subscription_type: "full_day",
        shift_type: null,
        has_sheet: false,
        amount_paid: 900,
        payment_mode: "online",
        start_date: getDemoISTDate(0),
        end_date: getDemoISTDate(30),
        created_at: new Date(Date.now() - 500 * 60 * 1000).toISOString(),
        payment_type: "new",
      },
    ],
  };
}

/**
 * Generate synthetic due fees candidates for /due-fees?slug=demo-library
 */
export function getDemoDueFees() {
  const seats = getDemoSeats();
  const overdueSeats = seats.filter((s) => s.is_overdue && s.receipts.length > 0);

  const candidates = overdueSeats.map((s, idx) => {
    const r = s.receipts[0];
    const days = r.days_overdue || (idx % 7) + 2;
    let severity: "1_to_3_days" | "4_to_7_days" | "7_plus_days" = "1_to_3_days";
    if (days >= 7) severity = "7_plus_days";
    else if (days >= 4) severity = "4_to_7_days";

    return {
      receipt_no: r.receipt_no,
      student_id: r.student_id,
      name: r.member.name,
      phone: r.member.phone,
      seat_id: s.seat_id,
      seat_number: s.seat_number,
      subscription_type: r.subscription_type,
      shift_type: r.shift_type,
      has_sheet: r.has_sheet,
      amount_paid: r.amount_paid,
      start_date: r.start_date,
      end_date: r.end_date,
      days_overdue: days,
      severity,
    };
  });

  const d1_3 = candidates.filter((c) => c.severity === "1_to_3_days").length;
  const d4_7 = candidates.filter((c) => c.severity === "4_to_7_days").length;
  const d7p = candidates.filter((c) => c.severity === "7_plus_days").length;
  const totalAmount = candidates.reduce((sum, c) => sum + c.amount_paid, 0);

  return {
    summary: {
      total_due_count: candidates.length,
      days_1_to_3: d1_3,
      days_4_to_7: d4_7,
      days_7_plus: d7p,
      estimated_pending_fees: totalAmount,
    },
    candidates,
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

export interface DemoExpense {
  id: string;
  library_id: string;
  title: string;
  category: "electricity" | "rent" | "wifi" | "water_tea" | "staff_salary" | "maintenance" | "misc";
  amount: number;
  payment_mode: "cash" | "online" | "upi";
  expense_date: string;
  notes?: string;
  created_at: string;
}

/**
 * Generate realistic synthetic operating expenses for Demo Lounge
 */
export function getDemoExpenses(): {
  expenses: DemoExpense[];
  summary: {
    gross_collections: number;
    total_expenses: number;
    net_profit: number;
    profit_margin: string;
    by_category: Record<string, number>;
  };
} {
  const expenses: DemoExpense[] = [
    {
      id: "exp-demo-01",
      library_id: DEMO_LIBRARY_ID,
      title: "Main Study Hall Commercial Rent (Ground + 1st Floor)",
      category: "rent",
      amount: 25000,
      payment_mode: "online",
      expense_date: getDemoISTDate(-12),
      notes: "Paid via NEFT directly to landlord account",
      created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-02",
      library_id: DEMO_LIBRARY_ID,
      title: "Commercial Electricity & 6x Dual-Inverter AC Power Bill",
      category: "electricity",
      amount: 14850,
      payment_mode: "online",
      expense_date: getDemoISTDate(-8),
      notes: "State Electricity Board payment for peak summer AC run",
      created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-03",
      library_id: DEMO_LIBRARY_ID,
      title: "Caretaker & Night Supervisor Salary",
      category: "staff_salary",
      amount: 9000,
      payment_mode: "cash",
      expense_date: getDemoISTDate(-11),
      notes: "Monthly salary for night check-ins and lockup",
      created_at: new Date(Date.now() - 11 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-04",
      library_id: DEMO_LIBRARY_ID,
      title: "Housekeeping & Sanitization Staff",
      category: "staff_salary",
      amount: 5500,
      payment_mode: "cash",
      expense_date: getDemoISTDate(-11),
      notes: "Daily floor mopping, desk wiping, and dustbin clearance",
      created_at: new Date(Date.now() - 11 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-05",
      library_id: DEMO_LIBRARY_ID,
      title: "Dual Commercial Fiber Lease 300 Mbps (Airtel + Jio Fallback)",
      category: "wifi",
      amount: 2199,
      payment_mode: "online",
      expense_date: getDemoISTDate(-6),
      notes: "High-speed zero-downtime internet for 200 study desks",
      created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-06",
      library_id: DEMO_LIBRARY_ID,
      title: "RO Chilled & Warm Drinking Water 20L Canisters (45 Jars)",
      category: "water_tea",
      amount: 1350,
      payment_mode: "upi",
      expense_date: getDemoISTDate(-3),
      notes: "Bi-weekly supplier delivery at ₹30 per 20L canister",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-07",
      library_id: DEMO_LIBRARY_ID,
      title: "Cushion Chair Hydraulic Struts & LED Study Tube Replacements",
      category: "maintenance",
      amount: 1800,
      payment_mode: "cash",
      expense_date: getDemoISTDate(-2),
      notes: "Fixed 3 squeaky study chairs and replaced flickering tubes",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "exp-demo-08",
      library_id: DEMO_LIBRARY_ID,
      title: "Desk Cleaners, Phenyl & Air Freshener Cans",
      category: "misc",
      amount: 650,
      payment_mode: "upi",
      expense_date: getDemoISTDate(-1),
      notes: "Counter cleaning supplies",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  const total_expenses = expenses.reduce((sum, e) => sum + e.amount, 0); // ₹60,349
  const gross_collections = 112400; // Simulated active demo monthly collections
  const net_profit = gross_collections - total_expenses; // ₹52,051
  const profit_margin = ((net_profit / gross_collections) * 100).toFixed(1); // 46.3%

  const by_category: Record<string, number> = {};
  for (const e of expenses) {
    by_category[e.category] = (by_category[e.category] || 0) + e.amount;
  }

  return {
    expenses,
    summary: {
      gross_collections,
      total_expenses,
      net_profit,
      profit_margin,
      by_category,
    },
  };
}

