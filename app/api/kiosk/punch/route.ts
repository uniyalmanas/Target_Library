import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getLibraryBySlug,
  DEFAULT_LIBRARY_ID,
  DEMO_LIBRARY_ID,
  isDemoSlug,
} from "@/lib/tenant";
import { addLocalGateLog, getLocalGateLogs, StoredGateLog } from "@/lib/localGateLogs";
import { getDemoSeats } from "@/lib/demoData";

// POST /api/kiosk/punch
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      slug = "target-library",
      identifier, // student_id (e.g. 6309) OR 10-digit phone number
      action = "toggle", // "in" | "out" | "toggle"
      notes,
    } = body;

    if (!identifier || !identifier.toString().trim()) {
      return NextResponse.json(
        { error: "Please enter your Member ID or registered phone number." },
        { status: 400 }
      );
    }

    const cleanId = identifier.toString().trim().replace(/[^0-9]/g, "");
    let libraryId = isDemoSlug(slug) ? DEMO_LIBRARY_ID : DEFAULT_LIBRARY_ID;

    if (slug && !isDemoSlug(slug)) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
      } catch {
        // fallback
      }
    }

    // 1. Resolve Student & Active Subscription
    let studentRecord: {
      student_id: number;
      name: string;
      phone: string | null;
      seat_number: number | null;
      subscription_type: string;
      shift_type: string | null;
      end_date?: string;
      is_overdue?: boolean;
    } | null = null;

    if (isDemoSlug(slug)) {
      // Lookup in 200 demo seats
      const demoSeats = getDemoSeats();
      for (const s of demoSeats) {
        for (const r of s.receipts) {
          const sid = r.member.student_id.toString();
          const cleanP = (r.member.phone || "").replace(/[^0-9]/g, "");
          if (sid === cleanId || cleanP.endsWith(cleanId) || cleanId.endsWith(cleanP)) {
            studentRecord = {
              student_id: r.member.student_id,
              name: r.member.name,
              phone: r.member.phone,
              seat_number: s.seat_number,
              subscription_type: r.subscription_type,
              shift_type: r.shift_type,
              end_date: r.end_date,
              is_overdue: r.is_overdue,
            };
            break;
          }
        }
        if (studentRecord) break;
      }

      // Fallback procedural demo student if ID wasn't in sample seats
      if (!studentRecord) {
        const numId = Number(cleanId) || 1001;
        studentRecord = {
          student_id: numId,
          name: `Student #${numId}`,
          phone: `98765 ${String(numId % 10000).padStart(5, "0")}`,
          seat_number: (numId % 180) + 1,
          subscription_type: numId % 2 === 0 ? "full_day" : "half_day",
          shift_type: numId % 2 === 0 ? "full_day" : "shift_1",
          end_date: "2026-09-30",
          is_overdue: false,
        };
      }
    } else {
      // Lookup in Supabase receipts
      let receiptQuery = supabase
        .from("receipts")
        .select(`
          receipt_no,
          student_id,
          name,
          phone,
          subscription_type,
          shift_type,
          start_date,
          end_date,
          is_vacated,
          seats ( seat_number )
        `)
        .eq("library_id", libraryId)
        .order("start_date", { ascending: false });

      if (cleanId.length <= 6) {
        // Likely a student_id / member_id
        receiptQuery = receiptQuery.eq("student_id", Number(cleanId));
      } else {
        // Likely a 10-digit phone
        receiptQuery = receiptQuery.ilike("phone", `%${cleanId.slice(-10)}%`);
      }

      const { data: receipts, error: rErr } = await receiptQuery;

      if (!rErr && receipts && receipts.length > 0) {
        // Prefer active non-vacated receipt
        const active = receipts.find((r) => !r.is_vacated) || receipts[0];
        const today = new Date().toISOString().split("T")[0];
        const isOverdue = active.end_date ? active.end_date < today : false;
        const seatNum = (active as any).seats?.seat_number || null;

        studentRecord = {
          student_id: active.student_id,
          name: active.name,
          phone: active.phone || null,
          seat_number: seatNum,
          subscription_type: active.subscription_type || "half_day",
          shift_type: active.shift_type || null,
          end_date: active.end_date,
          is_overdue: isOverdue,
        };
      } else {
        // Try members table
        const { data: member } = await supabase
          .from("members")
          .select("student_id, name, phone")
          .eq("library_id", libraryId)
          .or(`student_id.eq.${Number(cleanId) || -1},phone.ilike.%${cleanId.slice(-10)}%`)
          .maybeSingle();

        if (member) {
          studentRecord = {
            student_id: member.student_id,
            name: member.name,
            phone: member.phone,
            seat_number: null,
            subscription_type: "half_day",
            shift_type: "shift_1",
            is_overdue: false,
          };
        }
      }
    }

    if (!studentRecord) {
      return NextResponse.json(
        {
          error: `No registered student found matching "${identifier}". Please check your Member ID or register at the front desk.`,
        },
        { status: 404 }
      );
    }

    // 2. Determine Current Presence (Latest Punch)
    let latestPunch: StoredGateLog | null = null;
    try {
      const { data: dbLatest } = await supabase
        .from("gate_logs")
        .select("*")
        .eq("library_id", libraryId)
        .eq("student_id", studentRecord.student_id)
        .order("punch_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbLatest) {
        latestPunch = dbLatest;
      } else {
        const localLogs = getLocalGateLogs(libraryId);
        latestPunch = localLogs.find((l) => l.student_id === studentRecord!.student_id) || null;
      }
    } catch {
      const localLogs = getLocalGateLogs(libraryId);
      latestPunch = localLogs.find((l) => l.student_id === studentRecord!.student_id) || null;
    }

    // Determine target punch type
    let targetPunchType: "in" | "out" = "in";
    if (action === "in") {
      targetPunchType = "in";
    } else if (action === "out") {
      targetPunchType = "out";
    } else {
      // Toggle mode: if currently in, punch out; otherwise punch in
      targetPunchType = latestPunch?.punch_type === "in" ? "out" : "in";
    }

    const punchTime = new Date().toISOString();

    // 3. Insert Punch Log (Supabase with Local Fallback)
    let insertedPunch: any = null;
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("gate_logs")
        .insert({
          library_id: libraryId,
          student_id: studentRecord.student_id,
          student_name: studentRecord.name,
          student_phone: studentRecord.phone,
          seat_number: studentRecord.seat_number,
          subscription_type: studentRecord.subscription_type,
          shift_type: studentRecord.shift_type,
          punch_type: targetPunchType,
          punch_time: punchTime,
          notes: notes || "Kiosk punch",
        })
        .select()
        .single();

      if (!insertError && inserted) {
        insertedPunch = inserted;
      } else {
        insertedPunch = addLocalGateLog({
          library_id: libraryId,
          student_id: studentRecord.student_id,
          student_name: studentRecord.name,
          student_phone: studentRecord.phone,
          seat_number: studentRecord.seat_number,
          subscription_type: studentRecord.subscription_type,
          shift_type: studentRecord.shift_type,
          punch_type: targetPunchType,
          punch_time: punchTime,
          notes: notes || "Kiosk punch (local)",
        });
      }
    } catch {
      insertedPunch = addLocalGateLog({
        library_id: libraryId,
        student_id: studentRecord.student_id,
        student_name: studentRecord.name,
        student_phone: studentRecord.phone,
        seat_number: studentRecord.seat_number,
        subscription_type: studentRecord.subscription_type,
        shift_type: studentRecord.shift_type,
        punch_type: targetPunchType,
        punch_time: punchTime,
        notes: notes || "Kiosk punch (local)",
      });
    }

    const punchTimeFormatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(punchTime));

    const message =
      targetPunchType === "in"
        ? `Welcome, ${studentRecord.name}! Checked In at ${punchTimeFormatted}. Seat #${studentRecord.seat_number || "Open"}`
        : `Goodbye, ${studentRecord.name}! Checked Out at ${punchTimeFormatted}. Have a great day!`;

    return NextResponse.json({
      success: true,
      punch_type: targetPunchType,
      message,
      student: studentRecord,
      punch: insertedPunch,
    });
  } catch (error: any) {
    console.error("POST /api/kiosk/punch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record gate punch" },
      { status: 500 }
    );
  }
}
