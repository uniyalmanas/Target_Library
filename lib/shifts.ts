import { ShiftConfig } from "./types";
import { DEFAULT_SHIFTS } from "./tenant";

export interface TimeInterval {
  start: number; // minutes from midnight [0, 1440)
  end: number;   // minutes from midnight (0, 1440]
}

/**
 * Converts "HH:mm" to minutes from 00:00.
 * If isEndTime is true and time is "00:00" or "24:00", converts to 1440 (end of day).
 */
export function parseTimeToMinutes(timeStr?: string | null, isEndTime: boolean = false): number {
  if (!timeStr) return isEndTime ? 1440 : 0;
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);

  if (isEndTime && ((h === 0 && m === 0) || h === 24)) {
    return 1440;
  }
  return h * 60 + m;
}

/**
 * Converts a shift's start_time and end_time into 1 or 2 non-wrapping intervals.
 * Handles overnight shifts (e.g. 22:00 to 06:00 -> [1320, 1440] and [0, 360]).
 */
export function getShiftIntervals(shift: ShiftConfig): TimeInterval[] {
  const start = parseTimeToMinutes(shift.start_time, false);
  const end = parseTimeToMinutes(shift.end_time, true);

  if (start < end) {
    return [{ start, end }];
  } else if (start > end) {
    // Overnights: e.g. 21:00 to 05:00
    return [
      { start, end: 1440 },
      { start: 0, end },
    ];
  } else {
    // start === end (24h shift)
    return [{ start: 0, end: 1440 }];
  }
}

/**
 * Determines if two time intervals overlap (clash).
 * Touching boundaries (e.g. 06:00-14:00 and 14:00-22:00) do NOT overlap.
 */
export function doIntervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

/**
 * Resolves a ShiftConfig from an ID or legacy alias.
 */
export function resolveShift(shiftId: string | null | undefined, shiftsConfig: ShiftConfig[] = DEFAULT_SHIFTS): ShiftConfig | null {
  if (!shiftId) return null;
  const cleanId = shiftId.toLowerCase().trim();

  // 1. Exact match in config by ID
  const found = shiftsConfig.find((s) => s.id.toLowerCase() === cleanId);
  if (found) return found;

  // 2. Match in config by name
  const foundByName = shiftsConfig.find((s) => s.name.toLowerCase() === cleanId || s.name.toLowerCase().startsWith(cleanId));
  if (foundByName) return foundByName;

  // 3. Legacy aliases
  if (cleanId === "morning") {
    return shiftsConfig.find((s) => s.id === "shift_1") || shiftsConfig.find((s) => s.id !== "full_day") || DEFAULT_SHIFTS[1];
  }
  if (cleanId === "evening") {
    return shiftsConfig.find((s) => s.id === "shift_2") || shiftsConfig.find((s) => s.id !== "full_day" && s.id !== "shift_1") || DEFAULT_SHIFTS[2];
  }

  // 4. Fallback defaults
  const fallback = DEFAULT_SHIFTS.find((s) => s.id.toLowerCase() === cleanId);
  if (fallback) return fallback;

  return null;
}

/**
 * Checks if two shifts clash (overlap in time).
 */
export function doShiftsClash(
  shiftAId: string | null | undefined,
  shiftBId: string | null | undefined,
  shiftsConfig: ShiftConfig[] = DEFAULT_SHIFTS
): boolean {
  if (!shiftAId || !shiftBId) return false;
  if (shiftAId === "full_day" || shiftBId === "full_day") return true;

  // Identical shift ID always clashes
  if (shiftAId === shiftBId) return true;

  const shiftA = resolveShift(shiftAId, shiftsConfig);
  const shiftB = resolveShift(shiftBId, shiftsConfig);

  if (!shiftA || !shiftB) {
    // If unknown, assume same IDs clash
    return shiftAId === shiftBId;
  }

  const intervalsA = getShiftIntervals(shiftA);
  const intervalsB = getShiftIntervals(shiftB);

  for (const intA of intervalsA) {
    for (const intB of intervalsB) {
      if (doIntervalsOverlap(intA, intB)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns all shifts from shiftsConfig that can be assigned to a seat without clashing
 * with any of the currently active receipts.
 */
export function getAvailableShiftsForSeat(
  activeReceipts: Array<{ subscription_type?: string; shift_type?: string | null }>,
  shiftsConfig: ShiftConfig[] = DEFAULT_SHIFTS
): ShiftConfig[] {
  // If seat has a full-day subscription, no more shifts can fit
  const hasFullDay = activeReceipts.some((r) => r.subscription_type === "full_day");
  if (hasFullDay) return [];

  const occupiedShiftIds = activeReceipts
    .map((r) => r.shift_type)
    .filter(Boolean) as string[];

  // Candidate shifts: all non-full_day shifts defined in shiftsConfig
  const candidateShifts = shiftsConfig.filter((s) => s.id !== "full_day");

  return candidateShifts.filter((candidate) => {
    // Cannot re-book the same shift ID if already active
    if (occupiedShiftIds.includes(candidate.id)) return false;

    // Must not clash with ANY currently occupied shift on this seat
    const hasClash = occupiedShiftIds.some((occId) =>
      doShiftsClash(candidate.id, occId, shiftsConfig)
    );

    return !hasClash;
  });
}

export type ComputedSeatStatus =
  | "free"          // GREEN: 0 occupants
  | "full_day"      // RED: 1 person bought the seat for their period
  | "half_day"      // YELLOW: 1+ shifts occupied, yet you can still accommodate another person
  | "double_shift"  // PURPLE: multiple students occupied with different shifts and is full (no more seats)
  | "due"           // BLUE: entire seat overdue
  | "partial_due";  // Gradient BLUE/YELLOW: 1 active shift + 1 overdue shift

/**
 * Evaluates seat status strictly according to the platform's color rules:
 * - RED: FULL DAY (1 person allocating the shift for all day and for a fixed duration of time).
 * - GREEN: Free seat (0 occupants, available for any shift).
 * - ORANGE: Partially filled (1+ shifts occupied, yet another shift can still be accommodated).
 * - PURPLE: Completely occupied by multiple shifts and more shifts cannot be added into it.
 * - BLUE: Due fees / overdue.
 */
export function computeSeatStatus(
  activeReceipts: any[],
  deduplicatedOverdue: any[],
  shiftsConfig: ShiftConfig[] = DEFAULT_SHIFTS
): {
  status: ComputedSeatStatus;
  availableShifts: ShiftConfig[];
  isFullDay: boolean;
  isFull: boolean;
  canAccommodateAnother: boolean;
} {
  const isAllOverdue = activeReceipts.length === 0 && deduplicatedOverdue.length > 0;
  const isPartialDue = activeReceipts.length > 0 && deduplicatedOverdue.length > 0;

  if (isAllOverdue) {
    return {
      status: "due",
      availableShifts: [],
      isFullDay: false,
      isFull: true,
      canAccommodateAnother: false,
    };
  }

  if (activeReceipts.length === 0) {
    const candidateShifts = shiftsConfig.filter((s) => s.id !== "full_day");
    return {
      status: "free",
      availableShifts: candidateShifts,
      isFullDay: false,
      isFull: false,
      canAccommodateAnother: true,
    };
  }

  const isFullDay = activeReceipts.some((r) => r.subscription_type === "full_day");
  if (isFullDay) {
    return {
      status: "full_day", // RED
      availableShifts: [],
      isFullDay: true,
      isFull: true,
      canAccommodateAnother: false,
    };
  }

  // Seat is occupied by 1 or more half_day shifts
  const availableShifts = getAvailableShiftsForSeat(activeReceipts, shiftsConfig);
  const canAccommodateAnother = availableShifts.length > 0;

  if (isPartialDue) {
    return {
      status: "partial_due",
      availableShifts,
      isFullDay: false,
      isFull: !canAccommodateAnother,
      canAccommodateAnother,
    };
  }

  if (canAccommodateAnother) {
    // 1 or more shifts taken, but another person/shift can still be accommodated -> ORANGE
    return {
      status: "half_day", // ORANGE (partially filled)
      availableShifts,
      isFullDay: false,
      isFull: false,
      canAccommodateAnother: true,
    };
  } else {
    // Multiple shifts occupied and is completely full: no other student can be accommodated -> PURPLE
    return {
      status: "double_shift", // PURPLE (multi-shift full)
      availableShifts: [],
      isFullDay: false,
      isFull: true,
      canAccommodateAnother: false,
    };
  }
}

/**
 * Converts 24-hour "HH:mm" to 12-hour format (e.g. "06:00" -> "6 AM", "14:30" -> "2:30 PM").
 */
export function formatTime12Hour(timeStr?: string | null): string {
  if (!timeStr) return "";
  const clean = timeStr.trim();
  const parts = clean.split(":");
  let h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return clean;
  const ampm = h >= 12 && h < 24 ? "PM" : "AM";
  if (h === 0 || h === 24) {
    h = 12;
  } else if (h > 12) {
    h -= 12;
  }
  const minStr = m > 0 ? `:${m.toString().padStart(2, "0")}` : "";
  return `${h}${minStr} ${ampm}`;
}

/**
 * Formats a shift's start and end times into a friendly string (e.g. "6 AM - 10 AM").
 */
export function formatShiftTiming(shift?: ShiftConfig | null): string {
  if (!shift) return "";
  if (!shift.start_time && !shift.end_time) return "";
  const start = formatTime12Hour(shift.start_time);
  const end = formatTime12Hour(shift.end_time);
  if (!start && !end) return "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

/**
 * Checks if a shift name already contains explicit time indications.
 */
export function hasTimingInName(name?: string | null): boolean {
  if (!name) return false;
  return (
    /\b(am|pm)\b/i.test(name) ||
    /\d{1,2}:\d{2}/.test(name) ||
    /\d{1,2}\s*-\s*\d{1,2}/.test(name) ||
    /\d{1,2}\s*to\s*\d{1,2}/i.test(name)
  );
}

/**
 * Returns the shift name accompanied by its timing if not already present in the name.
 */
export function getShiftNameWithTiming(shift?: ShiftConfig | null): string {
  if (!shift) return "";
  if (!shift.name) return "";
  if (hasTimingInName(shift.name)) return shift.name;
  const timing = formatShiftTiming(shift);
  return timing ? `${shift.name} (${timing})` : shift.name;
}

/**
 * Chronologically sorts shifts:
 * 1. Full Day shifts remain pinned at the top.
 * 2. Ascending order by start_time (in minutes from midnight).
 * 3. Secondary ascending order by end_time.
 * 4. Alphabetical tie-breaker on shift name.
 */
export function sortShiftsChronologically(shifts: ShiftConfig[] = []): ShiftConfig[] {
  return [...shifts].sort((a, b) => {
    const isFullDayA = a.id === "full_day" || a.name.toLowerCase().includes("full day");
    const isFullDayB = b.id === "full_day" || b.name.toLowerCase().includes("full day");

    // Full Day shifts stay pinned at the top
    if (isFullDayA && !isFullDayB) return -1;
    if (isFullDayB && !isFullDayA) return 1;

    // Primary sort: ascending start_time
    const startA = parseTimeToMinutes(a.start_time, false);
    const startB = parseTimeToMinutes(b.start_time, false);
    if (startA !== startB) {
      return startA - startB;
    }

    // Secondary sort: ascending end_time
    const endA = parseTimeToMinutes(a.end_time, true);
    const endB = parseTimeToMinutes(b.end_time, true);
    if (endA !== endB) {
      return endA - endB;
    }

    // Tertiary sort: alphabetically by name
    return (a.name || "").localeCompare(b.name || "");
  });
}

/**
 * Returns human-readable shift name and timing based on shiftsConfig.
 */
export function getShiftDisplayLabel(
  shiftId: string | null | undefined,
  subType?: string | null,
  shiftsConfig: ShiftConfig[] = DEFAULT_SHIFTS
): string {
  if (subType === "full_day") {
    const full = shiftsConfig.find((s) => s.id === "full_day");
    if (full) {
      return getShiftNameWithTiming(full);
    }
    return "Full Day (6 AM - 12 AM)";
  }

  if (!shiftId) return "Half Day";

  const resolved = resolveShift(shiftId, shiftsConfig);
  if (resolved) {
    return getShiftNameWithTiming(resolved);
  }

  return shiftId;
}
