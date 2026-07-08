"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface ParsedRow {
  student_id?: number;
  name: string;
  phone?: string;
  seat_number: number;
  subscription_type: "full_day" | "half_day";
  shift_type?: "shift_1" | "shift_2" | "shift_3" | "morning" | "evening";
  has_sheet?: boolean;
  amount_paid: number;
  start_date: string;
  _error?: string;
}

const TEMPLATE_HEADERS = [
  "student_id",
  "name",
  "phone",
  "seat_number",
  "subscription_type",
  "shift_type",
  "has_sheet",
  "amount_paid",
  "start_date",
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    [
      "", "Manas Uniyal", "9876543210", 154, "full_day", "", "TRUE", 900,
      new Date().toISOString().split("T")[0],
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  XLSX.writeFile(wb, "library_import_template.xlsx");
}

function excelDateToISO(value: any): string {
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(value);
}

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [committing, setCommitting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: ParsedRow[] = json.map((r) => {
        let error = "";
        if (!r.name) error = "Missing name";
        if (!r.seat_number) error = "Missing seat_number";
        if (!r.amount_paid) error = "Missing amount_paid";
        if (!["full_day", "half_day"].includes(r.subscription_type)) error = "Invalid subscription_type";

        return {
          student_id: r.student_id ? Number(r.student_id) : undefined,
          name: r.name,
          phone: r.phone ? String(r.phone) : undefined,
          seat_number: Number(r.seat_number),
          subscription_type: r.subscription_type,
          shift_type: r.shift_type || undefined,
          has_sheet: String(r.has_sheet).toUpperCase() === "TRUE",
          amount_paid: Number(r.amount_paid),
          start_date: r.start_date ? excelDateToISO(r.start_date) : new Date().toISOString().split("T")[0],
          _error: error,
        };
      });
      setRows(parsed);
      setResults(null);
    };
    reader.readAsBinaryString(file);
  }

  async function handleCommit() {
    setCommitting(true);
    const validRows = rows.filter((r) => !r._error);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    const data = await res.json();
    setResults(data.results);
    setCommitting(false);
  }

  const errorCount = rows.filter((r) => r._error).length;

  return (
    <div className="space-y-6">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
          Bulk Data Migration
        </h1>
        <p className="text-xs text-text-muted mt-1">Upload a library register spreadsheet (Excel/CSV) to mass import member profiles and space reservations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Actions panel */}
        <div className="md:col-span-1 bg-panel-bg border border-panel-border rounded-2xl p-6 h-fit space-y-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-2">Step 1: Download Format</h2>
            <p className="text-xs text-text-muted mb-4">Ensure your spreadsheet columns exactly match our schema structure before uploading.</p>
            <button
              onClick={downloadTemplate}
              className="w-full text-center bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-rose-600 dark:text-rose-400 border border-panel-border font-semibold text-xs px-4 py-3 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>📥</span> Download Excel Template
            </button>
          </div>

          <div className="pt-6 border-t border-panel-border">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">Step 2: Upload File</h2>
            <div className="relative group border border-panel-border hover:border-rose-500/40 border-dashed rounded-xl p-6 text-center transition-all bg-panel-bg/30">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-1">
                <span className="text-2xl">📄</span>
                <p className="text-xs text-foreground font-semibold">Click or Drag spreadsheet</p>
                <p className="text-[10px] text-text-muted">Supports .xlsx, .xls, or .csv</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="md:col-span-2 space-y-4">
          {rows.length > 0 ? (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-sm font-semibold text-foreground">
                  Spreadsheet Preview: <span className="font-mono text-text-details">{rows.length} rows parsed</span>
                </p>
                {errorCount > 0 ? (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
                    ⚠️ {errorCount} rows with errors (will be skipped)
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                    ✅ All rows valid
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-panel-border rounded-xl bg-card-bg">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-text-muted text-left border-b border-panel-border bg-panel-bg">
                      <th className="p-3">#</th>
                      <th className="p-3">Name</th>
                      <th className="p-3 text-center">Seat</th>
                      <th className="p-3">Subscription</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-b border-panel-border hover:bg-panel-bg/30 ${r._error ? "text-rose-600 dark:text-rose-400 bg-rose-500/5" : ""}`}>
                        <td className="p-3 font-mono text-text-muted">{i + 1}</td>
                        <td className="p-3 font-semibold">{r.name}</td>
                        <td className="p-3 text-center font-mono">{r.seat_number}</td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] uppercase font-bold ${
                            r.subscription_type === "full_day"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          }`}>
                            {r.subscription_type === "full_day" ? "Full" : r.shift_type || "Half"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold">₹{r.amount_paid}</td>
                        <td className="p-3 font-mono text-text-details">{r.start_date}</td>
                        <td className="p-3">
                          {r._error ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">{r._error}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCommit}
                  disabled={committing || errorCount === rows.length}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-5 py-3 rounded-lg shadow-md shadow-rose-600/10 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  {committing ? "Importing records..." : `Import ${rows.length - errorCount} Valid Rows`}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-panel-bg/30 border border-panel-border border-dashed rounded-2xl p-16 text-center space-y-2">
              <span className="text-4xl block">📊</span>
              <p className="text-sm font-semibold text-text-muted">No file uploaded yet</p>
              <p className="text-xs text-text-muted">Select or drop a spreadsheet template to preview data validation before database insertion.</p>
            </div>
          )}

          {results && (
            <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-panel-border">Transaction Status Log</h3>
              <div className="space-y-2 font-mono text-xs max-h-48 overflow-y-auto">
                {results.map((r: any) => (
                  <p key={r.row} className={`p-2 rounded-md ${r.status === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"}`}>
                    Row {r.row + 1}: {r.status === "ok" ? "Imported successfully" : r.message || "Failed"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
