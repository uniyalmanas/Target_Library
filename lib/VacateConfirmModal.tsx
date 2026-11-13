"use client";

import { useEffect } from "react";

export interface VacateCandidateInfo {
  studentName: string;
  seatNumber?: number | string;
  studentPhone?: string | null;
  shiftLabel?: string;
  daysOverdue?: number;
  amountPaid?: number;
  endDate?: string;
}

interface VacateConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isVacating?: boolean;
  candidate: VacateCandidateInfo | null;
}

export default function VacateConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isVacating = false,
  candidate,
}: VacateConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isVacating) onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isVacating, onClose]);

  if (!isOpen || !candidate) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-4 flex items-center justify-center animate-in fade-in"
      onClick={() => {
        if (!isVacating) onClose();
      }}
    >
      <div
        className="bg-card-bg border border-panel-border rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 flex flex-col p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center text-xl shrink-0">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-1">
              Final Warning
            </div>
            <h2 className="text-lg font-black text-text-main leading-tight">
              Confirm Seat Vacating
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Please review before vacating this student.
            </p>
          </div>
          <button
            disabled={isVacating}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-xs font-bold cursor-pointer transition shrink-0 disabled:opacity-50"
            title="Cancel (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Student & Seat Summary Card */}
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-3.5 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Student</span>
            <span className="text-sm font-black text-text-main truncate max-w-[200px]">
              {candidate.studentName}
            </span>
          </div>

          {candidate.seatNumber && (
            <div className="flex items-center justify-between border-t border-panel-border/50 pt-2">
              <span className="text-xs font-medium text-text-muted">Seat Number</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Seat #{candidate.seatNumber}
              </span>
            </div>
          )}

          {candidate.shiftLabel && (
            <div className="flex items-center justify-between border-t border-panel-border/50 pt-2">
              <span className="text-xs font-medium text-text-muted">Shift & Plan</span>
              <span className="text-xs font-medium text-text-main">
                {candidate.shiftLabel}
              </span>
            </div>
          )}

          {candidate.daysOverdue !== undefined && candidate.daysOverdue > 0 && (
            <div className="flex items-center justify-between border-t border-panel-border/50 pt-2">
              <span className="text-xs font-medium text-text-muted">Overdue Status</span>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                {candidate.daysOverdue} days overdue
              </span>
            </div>
          )}
        </div>

        {/* Warning Bullet Points */}
        <div className="bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20 rounded-2xl p-3.5 mb-5 text-xs space-y-1.5 text-rose-900 dark:text-rose-200">
          <p className="font-bold flex items-center gap-1 text-rose-700 dark:text-rose-300">
            <span>🚨</span> What will happen once you vacate:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-rose-800 dark:text-rose-300/90">
            {candidate.seatNumber && (
              <li>
                Seat <span className="font-bold">#{candidate.seatNumber}</span> will immediately turn <span className="font-bold text-emerald-600 dark:text-emerald-400">GREEN (free)</span> for new admissions.
              </li>
            )}
            <li>
              <span className="font-bold">{candidate.studentName}</span> will be <span className="font-bold">permanently removed</span> from the Due Fees list.
            </li>
            <li>
              All active receipt records for this student on this seat will be closed.
            </li>
            <li>
              The student will be recorded under <span className="font-bold">Left This Month</span>.
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isVacating}
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-panel-border text-text-main font-bold text-xs hover:bg-neutral-500/10 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isVacating}
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isVacating ? (
              <>
                <span className="animate-spin text-sm">⏳</span> Vacating...
              </>
            ) : (
              <>
                <span>🚪</span> Yes, Vacate Seat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
