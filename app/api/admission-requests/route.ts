import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID, isDemoSlug } from "@/lib/tenant";
import { getDemoAdmissionRequests } from "@/lib/demoData";

export const dynamic = "force-dynamic";

/**
 * GET /api/admission-requests?slug=target-library
 * Used by desk librarian dashboard to listen for incoming requests
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const status = searchParams.get("status") || "pending";

    if (isDemoSlug(slug)) {
      return NextResponse.json({
        requests: status === "pending" ? getDemoAdmissionRequests() : [],
      });
    }

    let libraryId = DEFAULT_LIBRARY_ID;
    if (slug) {
      const lib = await getLibraryBySlug(slug);
      libraryId = lib.id;
    }

    const { data, error } = await supabase
      .from("admission_requests")
      .select("*")
      .eq("library_id", libraryId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      // Table might not be created yet, return empty list safely
      return NextResponse.json({ requests: [] });
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admission-requests
 * Student Entrance QR submission with UPI UTR number
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      slug,
      student_name,
      student_phone,
      aadhar_no,
      subscription_type,
      shift_type,
      has_sheet = false,
      amount_paid,
      payment_mode = "online",
      utr_number,
    } = body;

    if (!student_name || !student_phone || !subscription_type || !amount_paid) {
      return NextResponse.json(
        { error: "Name, phone, plan, and amount are required" },
        { status: 400 }
      );
    }

    const library = await getLibraryBySlug(slug);

    const { data, error } = await supabase
      .from("admission_requests")
      .insert({
        library_id: library.id,
        student_name: student_name.trim(),
        student_phone: student_phone.trim(),
        aadhar_no: aadhar_no?.trim() || null,
        subscription_type,
        shift_type: subscription_type === "half_day" ? shift_type : null,
        has_sheet: Boolean(has_sheet),
        amount_paid: Number(amount_paid),
        payment_mode,
        utr_number: utr_number?.trim() || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit admission" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admission-requests
 * Desk Librarian: Approve or reject an admission request
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status, seat_id, start_date, end_date } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status are required" }, { status: 400 });
    }

    if (id.startsWith("demo-")) {
      if (status === "rejected") {
        return NextResponse.json({ success: true, status: "rejected" });
      }
      return NextResponse.json({
        success: true,
        status: "approved",
        student_id: 1099,
        receipt_no: 8999,
        message: `Allocated Seat #${seat_id || 3} to Arjun Kapoor (Demo)`,
      });
    }

    // Fetch the admission request
    const { data: request, error: fetchErr } = await supabase
      .from("admission_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !request) {
      return NextResponse.json({ error: "Admission request not found" }, { status: 404 });
    }

    if (status === "rejected") {
      await supabase
        .from("admission_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      return NextResponse.json({ success: true, status: "rejected" });
    }

    if (status === "approved") {
      if (!seat_id) {
        return NextResponse.json({ error: "Please allocate a seat to approve" }, { status: 400 });
      }

      // 1. Find or create member
      let studentId: number;
      const { data: existingMember } = await supabase
        .from("members")
        .select("student_id")
        .eq("phone", request.student_phone)
        .maybeSingle();

      if (existingMember) {
        studentId = existingMember.student_id;
      } else {
        const { data: newMem, error: memErr } = await supabase
          .from("members")
          .insert({
            name: request.student_name,
            phone: request.student_phone,
            aadhar_no: request.aadhar_no,
            date_of_joining: new Date().toISOString().split("T")[0],
            library_id: request.library_id,
          })
          .select("student_id")
          .single();

        if (memErr) throw memErr;
        studentId = newMem.student_id;
      }

      // 2. Generate Receipt
      const today = new Date();
      const sDate = start_date || today.toISOString().split("T")[0];
      const eDate =
        end_date ||
        new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: receipt, error: recErr } = await supabase
        .from("receipts")
        .insert({
          student_id: studentId,
          seat_id: Number(seat_id),
          subscription_type: request.subscription_type,
          shift_type: request.shift_type,
          has_sheet: request.has_sheet,
          amount_paid: request.amount_paid,
          payment_mode: request.payment_mode || "online",
          utr_number: request.utr_number,
          start_date: sDate,
          end_date: eDate,
          library_id: request.library_id,
        })
        .select("receipt_no")
        .single();

      if (recErr) throw recErr;

      // 3. Mark request as approved
      await supabase
        .from("admission_requests")
        .update({
          status: "approved",
          assigned_seat_id: Number(seat_id),
          assigned_receipt_no: receipt.receipt_no,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        receipt_no: receipt.receipt_no,
        student_id: studentId,
      });
    }

    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process approval" },
      { status: 500 }
    );
  }
}
