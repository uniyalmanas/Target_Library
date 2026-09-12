import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID, isDemoSlug } from "@/lib/tenant";
import { getDemoExpenses } from "@/lib/demoData";
import { getLocalExpenses, addLocalExpense, deleteLocalExpense } from "@/lib/localExpenses";

// GET /api/expenses?slug=target-library&month=2026-09
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "target-library";
    const month = searchParams.get("month"); // YYYY-MM
    const category = searchParams.get("category");

    if (isDemoSlug(slug)) {
      return NextResponse.json(getDemoExpenses());
    }

    let libraryId = DEFAULT_LIBRARY_ID;
    if (slug) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
      } catch {
        // fallback
      }
    }

    // 1. Fetch Expenses (with local fallback if Supabase table is not yet migrated)
    let expenses: any[] = [];
    try {
      let expenseQuery = supabase
        .from("expenses")
        .select("*")
        .eq("library_id", libraryId)
        .order("expense_date", { ascending: false });

      if (category && category !== "all") {
        expenseQuery = expenseQuery.eq("category", category);
      }

      if (month && month !== "all") {
        const startOfMonth = `${month}-01`;
        const [year, m] = month.split("-").map(Number);
        const lastDay = new Date(year, m, 0).getDate();
        const endOfMonth = `${month}-${String(lastDay).padStart(2, "0")}`;

        expenseQuery = expenseQuery
          .gte("expense_date", startOfMonth)
          .lte("expense_date", endOfMonth);
      }

      const { data: expensesData, error: expenseError } = await expenseQuery;
      if (!expenseError && expensesData) {
        expenses = expensesData;
      } else {
        // Fallback to local storage
        let local = getLocalExpenses(libraryId);
        if (category && category !== "all") {
          local = local.filter((e) => e.category === category);
        }
        if (month && month !== "all") {
          local = local.filter((e) => e.expense_date?.startsWith(month));
        }
        expenses = local;
      }
    } catch {
      let local = getLocalExpenses(libraryId);
      if (category && category !== "all") {
        local = local.filter((e) => e.category === category);
      }
      if (month && month !== "all") {
        local = local.filter((e) => e.expense_date?.startsWith(month));
      }
      expenses = local;
    }

    const total_expenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const by_category: Record<string, number> = {
      electricity: 0,
      rent: 0,
      wifi: 0,
      water_tea: 0,
      staff_salary: 0,
      maintenance: 0,
      misc: 0,
    };
    for (const e of expenses) {
      const cat = e.category || "misc";
      by_category[cat] = (by_category[cat] || 0) + Number(e.amount || 0);
    }

    // 2. Fetch Gross Collections from Receipts for the same period
    let receiptsQuery = supabase
      .from("receipts")
      .select("amount_paid, payment_mode, start_date, is_vacated")
      .eq("library_id", libraryId);

    if (month) {
      const startOfMonth = `${month}-01`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const endOfMonth = `${month}-${String(lastDay).padStart(2, "0")}`;

      receiptsQuery = receiptsQuery
        .gte("start_date", startOfMonth)
        .lte("start_date", endOfMonth);
    }

    const { data: receiptsData, error: receiptsError } = await receiptsQuery;

    let gross_collections = 0;
    let cash_collections = 0;
    let online_collections = 0;

    if (!receiptsError && receiptsData) {
      for (const r of receiptsData) {
        const amt = Number(r.amount_paid || 0);
        gross_collections += amt;
        if (r.payment_mode === "cash") {
          cash_collections += amt;
        } else {
          online_collections += amt;
        }
      }
    }

    const net_profit = gross_collections - total_expenses;
    const profit_margin =
      gross_collections > 0
        ? ((net_profit / gross_collections) * 100).toFixed(1)
        : "0.0";

    return NextResponse.json({
      expenses,
      summary: {
        gross_collections,
        cash_collections,
        online_collections,
        total_expenses,
        net_profit,
        profit_margin,
        by_category,
        count: expenses.length,
      },
    });
  } catch (error: any) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load expenses" },
      { status: 500 }
    );
  }
}

// POST /api/expenses
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      category = "misc",
      amount,
      payment_mode = "cash",
      expense_date,
      notes,
      slug = "target-library",
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Expense title is required" },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Please enter a valid expense amount" },
        { status: 400 }
      );
    }

    if (isDemoSlug(slug)) {
      // Simulate addition for demo
      return NextResponse.json({
        success: true,
        expense: {
          id: `exp-demo-${Date.now()}`,
          library_id: "demo",
          title: title.trim(),
          category,
          amount: numAmount,
          payment_mode,
          expense_date: expense_date || new Date().toISOString().split("T")[0],
          notes: notes || "",
          created_at: new Date().toISOString(),
        },
      });
    }

    let libraryId = DEFAULT_LIBRARY_ID;
    if (slug) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
      } catch {
        // fallback
      }
    }

    const date = expense_date || new Date().toISOString().split("T")[0];

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          library_id: libraryId,
          title: title.trim(),
          category,
          amount: numAmount,
          payment_mode,
          expense_date: date,
          notes: notes ? notes.trim() : null,
        })
        .select()
        .single();

      if (error) {
        console.warn("Supabase insert error, falling back to localExpenses:", error.message);
        const local = addLocalExpense({
          library_id: libraryId,
          title: title.trim(),
          category,
          amount: numAmount,
          payment_mode,
          expense_date: date,
          notes: notes ? notes.trim() : null,
        });
        return NextResponse.json({ success: true, expense: local, isLocal: true });
      }

      return NextResponse.json({ success: true, expense: data });
    } catch (dbErr: any) {
      console.warn("Supabase exception, falling back to localExpenses:", dbErr?.message);
      const local = addLocalExpense({
        library_id: libraryId,
        title: title.trim(),
        category,
        amount: numAmount,
        payment_mode,
        expense_date: date,
        notes: notes ? notes.trim() : null,
      });
      return NextResponse.json({ success: true, expense: local, isLocal: true });
    }
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record expense" },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses?id=...&slug=...
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const slug = searchParams.get("slug") || "target-library";

    if (!id) {
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    if (isDemoSlug(slug)) {
      return NextResponse.json({ success: true, simulated: true });
    }

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) {
        deleteLocalExpense(id);
        return NextResponse.json({ success: true, isLocal: true });
      }
      deleteLocalExpense(id);
      return NextResponse.json({ success: true });
    } catch {
      deleteLocalExpense(id);
      return NextResponse.json({ success: true, isLocal: true });
    }
  } catch (error: any) {
    console.error("DELETE /api/expenses error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete expense" },
      { status: 500 }
    );
  }
}
