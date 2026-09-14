import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, isDemoSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription-requests
 * Query params:
 *   - slug: fetch latest request for a library (used by paywall to show pending/rejected state)
 *   - all=true: fetch all requests for SuperAdmin
 *   - status: filter by status ("pending", "approved", "rejected")
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const isAll = searchParams.get("all") === "true";
    const statusFilter = searchParams.get("status");

    // Demo lounge mock handling
    if (slug && isDemoSlug(slug)) {
      return NextResponse.json({ request: null });
    }

    if (slug) {
      const { data, error } = await supabase
        .from("subscription_requests")
        .select("*")
        .eq("library_slug", slug)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        // Return null gracefully if table does not exist yet
        return NextResponse.json({ request: null });
      }

      return NextResponse.json({ request: data && data.length > 0 ? data[0] : null });
    }

    if (isAll) {
      let query = supabase
        .from("subscription_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        return NextResponse.json({ requests: [] });
      }

      return NextResponse.json({ requests: data || [] });
    }

    return NextResponse.json({ requests: [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load subscription requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscription-requests
 * Submit payment screenshot and details for subscription renewal / activation
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      library_id,
      library_slug,
      library_name,
      amount,
      plan_name = "Flat Monthly Pro (₹599)",
      billing_period_days = 30,
      screenshot_url,
      utr_number,
      notes,
    } = body;

    if (!library_slug) {
      return NextResponse.json({ error: "Library slug is required" }, { status: 400 });
    }

    if (!screenshot_url) {
      return NextResponse.json(
        { error: "Payment screenshot is required for verification" },
        { status: 400 }
      );
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    // Resolve library details if needed
    let resolvedId = library_id;
    let resolvedName = library_name;

    if (!resolvedId || !resolvedName) {
      const lib = await getLibraryBySlug(library_slug);
      resolvedId = resolvedId || lib.id;
      resolvedName = resolvedName || lib.name;
    }

    // Check if there is already a pending request for this library
    const { data: existingPending } = await supabase
      .from("subscription_requests")
      .select("id")
      .eq("library_slug", library_slug)
      .eq("status", "pending")
      .limit(1);

    let resultData;
    if (existingPending && existingPending.length > 0) {
      // Update existing pending request with new screenshot and amount
      const { data, error } = await supabase
        .from("subscription_requests")
        .update({
          amount: Number(amount),
          plan_name,
          billing_period_days: Number(billing_period_days) || 30,
          screenshot_url,
          utr_number: utr_number ? utr_number.trim() : null,
          notes: notes ? notes.trim() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPending[0].id)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    } else {
      // Insert new request
      const { data, error } = await supabase
        .from("subscription_requests")
        .insert({
          library_id: resolvedId,
          library_slug,
          library_name: resolvedName,
          amount: Number(amount),
          plan_name,
          billing_period_days: Number(billing_period_days) || 30,
          screenshot_url,
          utr_number: utr_number ? utr_number.trim() : null,
          notes: notes ? notes.trim() : null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    }

    return NextResponse.json({
      success: true,
      message: "Payment screenshot submitted successfully! Our team is verifying your payment.",
      request: resultData,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to submit subscription request. Please ensure the database migration has been run.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscription-requests
 * SuperAdmin actions: "approve" or "reject"
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, action, rejection_reason, reviewed_by = "Super Admin" } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Request ID and action are required" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 });
    }

    // 1. Fetch the request
    const { data: requestRecord, error: reqErr } = await supabase
      .from("subscription_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (reqErr || !requestRecord) {
      return NextResponse.json({ error: "Subscription request not found" }, { status: 404 });
    }

    if (action === "approve") {
      // 2. Fetch the target library
      const { data: lib, error: libErr } = await supabase
        .from("libraries")
        .select("*")
        .eq("id", requestRecord.library_id)
        .single();

      if (libErr || !lib) {
        return NextResponse.json({ error: "Associated library not found" }, { status: 404 });
      }

      // Calculate +30 days (or billing_period_days) from MAX(current_expiry, now)
      const days = Number(requestRecord.billing_period_days) || 30;
      const currentExpiry = lib.subscription_ends_at ? new Date(lib.subscription_ends_at).getTime() : Date.now();
      const baseTime = Math.max(currentExpiry, Date.now());
      const newExpiry = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

      // 3. Update library subscription to active
      const { error: updateLibErr } = await supabase
        .from("libraries")
        .update({
          subscription_status: "active",
          subscription_ends_at: newExpiry,
          trial_ends_at: null,
          monthly_fee: requestRecord.amount || lib.monthly_fee,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lib.id);

      if (updateLibErr) throw updateLibErr;

      // 4. Mark request as approved
      const { data: updatedReq, error: updateReqErr } = await supabase
        .from("subscription_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateReqErr) throw updateReqErr;

      return NextResponse.json({
        success: true,
        message: `Successfully approved payment! ${lib.name}'s subscription is active until ${new Date(newExpiry).toLocaleDateString("en-IN")}.`,
        request: updatedReq,
      });
    }

    if (action === "reject") {
      const reason = rejection_reason?.trim() || "Payment could not be verified. Please re-check amount or screenshot.";

      const { data: updatedReq, error: updateReqErr } = await supabase
        .from("subscription_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateReqErr) throw updateReqErr;

      return NextResponse.json({
        success: true,
        message: "Subscription request marked as rejected.",
        request: updatedReq,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process subscription request" },
      { status: 500 }
    );
  }
}
