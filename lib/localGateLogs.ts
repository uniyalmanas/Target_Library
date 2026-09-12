import fs from "fs";
import path from "path";

export interface StoredGateLog {
  id: string;
  library_id: string;
  student_id: number;
  student_name: string;
  student_phone?: string | null;
  seat_number?: number | null;
  subscription_type: string;
  shift_type?: string | null;
  punch_type: "in" | "out";
  punch_time: string;
  notes?: string | null;
  created_at: string;
}

const STORAGE_FILE = path.join(process.cwd(), "lib", "localGateLogsStorage.json");

function getTodayISTString(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getInitialSampleLogs(): StoredGateLog[] {
  const today = getTodayISTString();
  const targetLibId = "00000000-0000-0000-0000-000000000001";
  const demoLibId = "00000000-0000-0000-0000-000000000000";

  return [
    // Target Library realistic punches
    {
      id: "gate-sample-01",
      library_id: targetLibId,
      student_id: 6309,
      student_name: "Suman Bhandari",
      student_phone: "9410977059",
      seat_number: 45,
      subscription_type: "half_day",
      shift_type: "shift_1", // 6am - 2pm -> OVERSTAYING if current time is past 2pm!
      punch_type: "in",
      punch_time: `${today}T07:45:00.000Z`,
      notes: "Door tablet punch",
      created_at: `${today}T07:45:00.000Z`,
    },
    {
      id: "gate-sample-02",
      library_id: targetLibId,
      student_id: 6102,
      student_name: "Amit Rawat",
      student_phone: "9876543210",
      seat_number: 14,
      subscription_type: "half_day",
      shift_type: "shift_1", // 6am - 2pm -> OVERSTAYING!
      punch_type: "in",
      punch_time: `${today}T08:15:00.000Z`,
      notes: "Door tablet punch",
      created_at: `${today}T08:15:00.000Z`,
    },
    {
      id: "gate-sample-03",
      library_id: targetLibId,
      student_id: 6245,
      student_name: "Pooja Panwar",
      student_phone: "9837012345",
      seat_number: 88,
      subscription_type: "full_day", // 6am - 12am -> Legitimately in!
      punch_type: "in",
      punch_time: `${today}T09:30:00.000Z`,
      notes: "Door tablet punch",
      created_at: `${today}T09:30:00.000Z`,
    },
    {
      id: "gate-sample-04",
      library_id: targetLibId,
      student_id: 6411,
      student_name: "Deepak Sharma",
      student_phone: "9412098765",
      seat_number: 120,
      subscription_type: "half_day",
      shift_type: "shift_2", // 2pm - 12am -> Legitimately in!
      punch_type: "in",
      punch_time: `${today}T14:05:00.000Z`,
      notes: "Door tablet punch",
      created_at: `${today}T14:05:00.000Z`,
    },
    {
      id: "gate-sample-05",
      library_id: targetLibId,
      student_id: 6189,
      student_name: "Vikas Bisht",
      student_phone: "9568123456",
      seat_number: 32,
      subscription_type: "half_day",
      shift_type: "shift_1",
      punch_type: "out",
      punch_time: `${today}T13:50:00.000Z`,
      notes: "Checked out on time",
      created_at: `${today}T13:50:00.000Z`,
    },

    // Demo Library synthetic punches
    {
      id: "gate-demo-01",
      library_id: demoLibId,
      student_id: 1002,
      student_name: "Rahul Sharma",
      student_phone: "98765 01002",
      seat_number: 1,
      subscription_type: "half_day",
      shift_type: "shift_1", // 6am - 2pm -> OVERSTAYING
      punch_type: "in",
      punch_time: `${today}T07:10:00.000Z`,
      notes: "Demo Lounge punch",
      created_at: `${today}T07:10:00.000Z`,
    },
    {
      id: "gate-demo-02",
      library_id: demoLibId,
      student_id: 1014,
      student_name: "Priya Verma",
      student_phone: "98765 01014",
      seat_number: 7,
      subscription_type: "half_day",
      shift_type: "shift_1", // 6am - 2pm -> OVERSTAYING
      punch_type: "in",
      punch_time: `${today}T08:00:00.000Z`,
      notes: "Demo Lounge punch",
      created_at: `${today}T08:00:00.000Z`,
    },
    {
      id: "gate-demo-03",
      library_id: demoLibId,
      student_id: 1026,
      student_name: "Amit Patel",
      student_phone: "98765 01026",
      seat_number: 13,
      subscription_type: "full_day",
      shift_type: "full_day",
      punch_type: "in",
      punch_time: `${today}T09:15:00.000Z`,
      notes: "Demo Lounge punch",
      created_at: `${today}T09:15:00.000Z`,
    },
    {
      id: "gate-demo-04",
      library_id: demoLibId,
      student_id: 1038,
      student_name: "Sneha Singh",
      student_phone: "98765 01038",
      seat_number: 19,
      subscription_type: "half_day",
      shift_type: "shift_2",
      punch_type: "in",
      punch_time: `${today}T14:10:00.000Z`,
      notes: "Demo Lounge punch",
      created_at: `${today}T14:10:00.000Z`,
    },
  ];
}

function readStorage(): StoredGateLog[] {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      const initial = getInitialSampleLogs();
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read local gate logs storage:", err);
    return [];
  }
}

function writeStorage(items: StoredGateLog[]): boolean {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(items, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write local gate logs storage:", err);
    return false;
  }
}

export function getLocalGateLogs(libraryId: string, date?: string): StoredGateLog[] {
  const all = readStorage();
  let filtered = all.filter((l) => l.library_id === libraryId);
  if (date && date !== "all") {
    filtered = filtered.filter((l) => l.punch_time.startsWith(date));
  }
  return filtered.sort((a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime());
}

export function addLocalGateLog(
  log: Omit<StoredGateLog, "id" | "created_at">
): StoredGateLog {
  const all = readStorage();
  const newLog: StoredGateLog = {
    ...log,
    id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  all.unshift(newLog);
  writeStorage(all);
  return newLog;
}

export function getLatestStudentPunch(
  libraryId: string,
  studentId: number
): StoredGateLog | null {
  const logs = getLocalGateLogs(libraryId);
  const found = logs.find((l) => l.student_id === studentId);
  return found || null;
}
