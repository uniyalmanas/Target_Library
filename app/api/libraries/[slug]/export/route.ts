import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/libraries/[slug]/export?format=xlsx | csv&sheet=members | receipts | expenses | all
 * Generates an instant downloadable Excel workbook or CSV register for the library owner.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "xlsx";
    const sheetType = searchParams.get("sheet") || "all";

    const library = await getLibraryBySlug(slug);
    const libraryId = library.id;

    // 1. Fetch Members
    const { data: rawMembers } = await supabase
      .from("members")
      .select("*")
      .eq("library_id", libraryId)
      .order("student_id", { ascending: true });

    const membersData = (rawMembers || []).map((m: any) => ({
      "Student ID": m.student_id,
      "Full Name": m.name || "",
      "Phone Number": m.phone || "",
      "Aadhar Number": m.aadhar_no || "N/A",
      "Created At": m.created_at ? new Date(m.created_at).toLocaleDateString("en-IN") : "",
    }));

    // 2. Fetch Receipts & Collections
    const { data: rawReceipts } = await supabase
      .from("receipts")
      .select("*, members(name, phone), seats(seat_number)")
      .eq("library_id", libraryId)
      .order("receipt_no", { ascending: false });

    const receiptsData = (rawReceipts || []).map((r: any) => {
      const member = r.members as any;
      const seat = r.seats as any;
      return {
        "Receipt No": r.receipt_no,
        "Student Name": member?.name || "N/A",
        "Phone": member?.phone || "N/A",
        "Seat No": seat?.seat_number || r.seat_id,
        "Subscription": r.subscription_type === "full_day" ? "Full Day" : "Half Day",
        "Shift": r.shift_type || "N/A",
        "Sheet Addon": r.has_sheet ? "Yes" : "No",
        "Amount Paid (INR)": r.amount_paid,
        "Payment Mode": r.payment_mode === "online" ? "Online (UPI)" : "Cash",
        "Start Date": r.start_date,
        "Valid Till": r.end_date,
        "Status": r.is_vacated ? "Vacated" : "Active",
      };
    });

    // 3. Fetch Expenses
    let expensesData: any[] = [];
    try {
      const { data: rawExpenses } = await supabase
        .from("expenses")
        .select("*")
        .eq("library_id", libraryId)
        .order("date", { ascending: false });

      expensesData = (rawExpenses || []).map((e: any) => ({
        "Expense ID": e.id,
        "Date": e.date,
        "Category": e.category || "General",
        "Description": e.description || "",
        "Amount (INR)": e.amount,
        "Payment Mode": e.payment_mode || "Cash",
        "Logged At": e.created_at ? new Date(e.created_at).toLocaleString("en-IN") : "",
      }));
    } catch {
      // Expenses table optional
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // CSV format single sheet export
    if (format === "csv") {
      let activeData: any[] = membersData;
      let filename = `${slug}-members-${todayStr}.csv`;

      if (sheetType === "receipts") {
        activeData = receiptsData;
        filename = `${slug}-receipts-${todayStr}.csv`;
      } else if (sheetType === "expenses") {
        activeData = expensesData;
        filename = `${slug}-expenses-${todayStr}.csv`;
      }

      const ws = XLSX.utils.json_to_sheet(activeData);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);

      return new Response(csvOutput, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: Multi-sheet Excel workbook (.xlsx)
    const wb = XLSX.utils.book_new();

    const wsMembers = XLSX.utils.json_to_sheet(
      membersData.length > 0 ? membersData : [{ "Message": "No member records found." }]
    );
    XLSX.utils.book_append_sheet(wb, wsMembers, "Members Register");

    const wsReceipts = XLSX.utils.json_to_sheet(
      receiptsData.length > 0 ? receiptsData : [{ "Message": "No receipt records found." }]
    );
    XLSX.utils.book_append_sheet(wb, wsReceipts, "Receipts & Billing");

    const wsExpenses = XLSX.utils.json_to_sheet(
      expensesData.length > 0 ? expensesData : [{ "Message": "No expense records found." }]
    );
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Daily Expenses");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug}-backup-${todayStr}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to export data backup" },
      { status: 500 }
    );
  }
}