import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getLibraryBySlug,
  DEFAULT_LIBRARY_ID,
  DEMO_LIBRARY_ID,
  isDemoSlug,
  DEFAULT_SHIFTS,
} from "@/lib/tenant";
import { getLocalGateLogs, addLocalGateLog, StoredGateLog } from "@/lib/localGateLogs";

function getISTCurrentTime(): { hours: number; minutes: number; totalMinutes: number; timeString: string; dateString: string } {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const parts = istFormatter.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value || "0");

  return {
    hours: h,
    minutes: m,
    totalMinutes: h * 60 + m,
    timeString: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    dateString: dateParts,
  };
}

function parseTimeToMinutes(tStr: string): number {
  if (!tStr) return 1440; // end of day
  const [h, m] = tStr.split(":").map(Number);
  if (h === 0 && m === 0) return 1440; // 00:00 midnight is treated as 24:00 (1440 mins)
  return h * 60 + (m || 0);
}

// GET /api/kiosk?slug=target-library&date=2026-09-12
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "target-library";
    const ist = getISTCurrentTime();
    const dateParam = searchParams.get("date") || ist.dateString;

    let libraryId = isDemoSlug(slug) ? DEMO_LIBRARY_ID : DEFAULT_LIBRARY_ID;
    let shiftsConfig = DEFAULT_SHIFTS;

    if (slug && !isDemoSlug(slug)) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
        const { data: setRow } = await supabase
          .from("library_settings")
          .select("shifts_config")
          .eq("library_id", libraryId)
          .maybeSingle();
        if (setRow?.shifts_config) {
          shiftsConfig = setRow.shifts_config;
        }
      } catch {
        // fallback
      }
    }

    // 1. Fetch Today's Gate Logs (Supabase or Local Fallback)
    let logs: StoredGateLog[] = [];
    try {
      const { data: dbLogs, error: dbError } = await supabase
        .from("gate_logs")
        .select("*")
        .eq("library_id", libraryId)
        .gte("punch_time", `${dateParam}T00:00:00.000Z`)
        .lte("punch_time", `${dateParam}T23:59:59.999Z`)
        .order("punch_time", { ascending: false });

      if (!dbError && dbLogs && dbLogs.length > 0) {
        logs = dbLogs;
      } else {
        logs = getLocalGateLogs(libraryId, dateParam);
      }
    } catch {
      logs = getLocalGateLogs(libraryId, dateParam);
    }

    // 2. Aggregate Latest Punch per Student to determine who is currently INSIDE
    const studentLatestPunchMap = new Map<number, StoredGateLog>();
    const allPunchesByStudent = new Map<number, StoredGateLog[]>();

    for (const log of logs) {
      if (!studentLatestPunchMap.has(log.student_id)) {
        studentLatestPunchMap.set(log.student_id, log);
      }
      const existing = allPunchesByStudent.get(log.student_id) || [];
      existing.push(log);
      allPunchesByStudent.set(log.student_id, existing);
    }

    const insideStudents: Array<{
      student_id: number;
      student_name: string;
      student_phone: string | null;
      seat_number: number | null;
      subscription_type: string;
      shift_type: string | null;
      punch_time: string;
      punch_time_formatted: string;
      shift_end_time: string;
      is_overstay: boolean;
      overstay_minutes: number;
      overstay_formatted: string;
      is_warning: boolean;
      minutes_remaining: number;
    }> = [];

    let totalCheckedInCount = 0;
    let checkedOutCount = 0;

    for (const [, latest] of studentLatestPunchMap.entries()) {
      if (latest.punch_type === "in") {
        totalCheckedInCount++;

        // Determine registered shift end time
        let shiftEndTime = "14:00"; // default 2 PM for shift 1
        const sub = (latest.subscription_type || "").toLowerCase();
        const sh = (latest.shift_type || "").toLowerCase();

        if (sub === "full_day" || sh === "full_day") {
          shiftEndTime = "00:00";
        } else {
          const matchedShift = shiftsConfig.find(
            (s) =>
              s.id === sh ||
              (sh.includes("1") && s.id.includes("1")) ||
              (sh.includes("2") && s.id.includes("2")) ||
              (sh.includes("3") && s.id.includes("3"))
          );
          if (matchedShift) {
            shiftEndTime = matchedShift.end_time;
          } else if (sh === "shift_2" || sh === "evening") {
            shiftEndTime = "00:00";
          }
        }

        const shiftEndMins = parseTimeToMinutes(shiftEndTime);
        const currentMins = ist.totalMinutes;

        let isOverstay = false;
        let overstayMinutes = 0;
        let overstayFormatted = "";
        let isWarning = false;
        let minutesRemaining = 0;

        // Grace period of 5 minutes before marking as overstay
        if (sub !== "full_day" && currentMins > shiftEndMins + 5) {
          isOverstay = true;
          overstayMinutes = currentMins - shiftEndMins;
          const hrs = Math.floor(overstayMinutes / 60);
          const mins = overstayMinutes % 60;
          overstayFormatted = hrs > 0 ? `+${hrs}h ${mins}m` : `+${mins}m`;
        } else if (sub !== "full_day" && shiftEndMins > currentMins && shiftEndMins - currentMins <= 30) {
          isWarning = true;
          minutesRemaining = shiftEndMins - currentMins;
        }

        const pDate = new Date(latest.punch_time);
        const punchTimeFormatted = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(pDate);

        insideStudents.push({
          student_id: latest.student_id,
          student_name: latest.student_name,
          student_phone: latest.student_phone || null,
          seat_number: latest.seat_number || null,
          subscription_type: latest.subscription_type,
          shift_type: latest.shift_type || null,
          punch_time: latest.punch_time,
          punch_time_formatted: punchTimeFormatted,
          shift_end_time: shiftEndTime,
          is_overstay: isOverstay,
          overstay_minutes: overstayMinutes,
          overstay_formatted: overstayFormatted,
          is_warning: isWarning,
          minutes_remaining: minutesRemaining,
        });
      } else {
        checkedOutCount++;
      }
    }

    // Sort inside students: Overstaying first (descending overstay time), then warning, then normal
    insideStudents.sort((a, b) => {
      if (a.is_overstay && !b.is_overstay) return -1;
      if (!a.is_overstay && b.is_overstay) return 1;
      if (a.is_overstay && b.is_overstay) return b.overstay_minutes - a.overstay_minutes;
      return new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime();
    });

    const overstayAlerts = insideStudents.filter((s) => s.is_overstay);
    const warningAlerts = insideStudents.filter((s) => s.is_warning);

    return NextResponse.json({
      ist_time: ist.timeString,
      ist_date: ist.dateString,
      headcount: {
        total_inside: insideStudents.length,
        overstay_count: overstayAlerts.length,
        warning_count: warningAlerts.length,
        checked_out_count: checkedOutCount,
        total_entries_today: logs.filter((l) => l.punch_type === "in").length,
      },
      inside_students: insideStudents,
      overstay_alerts: overstayAlerts,
      recent_logs: logs.slice(0, 40),
    });
  } catch (error: any) {
    console.error("GET /api/kiosk error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load kiosk status" },
      { status: 500 }
    );
  }
}
