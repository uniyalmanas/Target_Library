import fs from "fs";
import path from "path";

export interface StoredExpense {
  id: string;
  library_id: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  expense_date: string;
  notes?: string | null;
  created_at: string;
}

const STORAGE_FILE = path.join(process.cwd(), "lib", "localExpensesStorage.json");

function readStorage(): StoredExpense[] {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      // Default sample expenses for Target Library if file is fresh
      const initial: StoredExpense[] = [
        {
          id: "exp-init-01",
          library_id: "00000000-0000-0000-0000-000000000001",
          title: "Commercial AC Power Bill (July/August)",
          category: "electricity",
          amount: 14200,
          payment_mode: "online",
          expense_date: "2026-09-05",
          notes: "State power corporation online receipt #UP-8291",
          created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
        {
          id: "exp-init-02",
          library_id: "00000000-0000-0000-0000-000000000001",
          title: "Hall Monthly Rent",
          category: "rent",
          amount: 22000,
          payment_mode: "online",
          expense_date: "2026-09-02",
          notes: "NEFT transfer to landlord",
          created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        },
        {
          id: "exp-init-03",
          library_id: "00000000-0000-0000-0000-000000000001",
          title: "Airtel Commercial Fiber 300 Mbps",
          category: "wifi",
          amount: 1999,
          payment_mode: "online",
          expense_date: "2026-09-08",
          notes: "Monthly business broadband connection",
          created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        },
        {
          id: "exp-init-04",
          library_id: "00000000-0000-0000-0000-000000000001",
          title: "RO Water Dispenser 20L Cans",
          category: "water_tea",
          amount: 950,
          payment_mode: "upi",
          expense_date: "2026-09-11",
          notes: "Delivered 30 chilled water jars",
          created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
        {
          id: "exp-init-05",
          library_id: "00000000-0000-0000-0000-000000000001",
          title: "Night Supervisor & Caretaker",
          category: "staff_salary",
          amount: 8000,
          payment_mode: "cash",
          expense_date: "2026-09-07",
          notes: "Desk duty and evening lockup",
          created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
      ];
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read local expenses storage:", err);
    return [];
  }
}

function writeStorage(items: StoredExpense[]): boolean {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(items, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write local expenses storage:", err);
    return false;
  }
}

export function getLocalExpenses(libraryId: string): StoredExpense[] {
  const all = readStorage();
  return all.filter((e) => e.library_id === libraryId);
}

export function addLocalExpense(item: Omit<StoredExpense, "id" | "created_at">): StoredExpense {
  const all = readStorage();
  const newRecord: StoredExpense = {
    ...item,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  all.unshift(newRecord);
  writeStorage(all);
  return newRecord;
}

export function deleteLocalExpense(id: string): boolean {
  const all = readStorage();
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length !== all.length) {
    return writeStorage(filtered);
  }
  return false;
}
