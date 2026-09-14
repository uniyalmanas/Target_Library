import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { FALLBACK_TARGET_LIBRARY, DEFAULT_LIBRARY_SLUG, DEFAULT_SHIFTS } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/libraries
 * Query parameters:
 *  - slug: fetch specific library by slug
 *  - all: if 'true', returns full list for SuperAdmin
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const isAll = searchParams.get("all") === "true";

    if (slug) {
      const { data, error } = await supabase
        .from("libraries")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        if (slug === DEFAULT_LIBRARY_SLUG) {
          return NextResponse.json({ library: FALLBACK_TARGET_LIBRARY });
        }
        return NextResponse.json({ error: "Library not found" }, { status: 404 });
      }

      return NextResponse.json({ library: data });
    }

    if (isAll) {
      const { data, error } = await supabase
        .from("libraries")
        .select(`
          *,
          library_settings (
            total_seats,
            has_sheet_enabled
          )
        `)
        .neq("slug", "platform-config")
        .order("created_at", { ascending: false });

      if (error) {
        // If table doesn't exist yet, return Target Library fallback array
        return NextResponse.json({ libraries: [FALLBACK_TARGET_LIBRARY] });
      }

      return NextResponse.json({ libraries: data || [FALLBACK_TARGET_LIBRARY] });
    }

    return NextResponse.json({ library: FALLBACK_TARGET_LIBRARY });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load library" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/libraries
 * Onboard a new library tenant
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      city,
      phone,
      address,
      monthly_fee = 600,
      total_seats = 50,
      upi_id,
      upi_name,
      owner_password = "OwnerPass2026",
      staff_password = "StaffPass2026",
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Library name and slug are required" }, { status: 400 });
    }

    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    // 1. Insert into libraries
    const { data: newLib, error: libErr } = await supabase
      .from("libraries")
      .insert({
        name,
        slug: cleanSlug,
        city: city || "Dehradun",
        phone: phone || null,
        address: address || null,
        monthly_fee: Number(monthly_fee) || 600,
        upi_id: upi_id || null,
        upi_name: upi_name || name,
        subscription_status: "trial",
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_ends_at: null,
      })
      .select()
      .single();

    if (libErr) {
      return NextResponse.json({ error: libErr.message }, { status: 400 });
    }

    // 2. Insert into library_settings
    await supabase.from("library_settings").insert({
      library_id: newLib.id,
      total_seats: Number(total_seats) || 50,
      shifts_config: DEFAULT_SHIFTS,
      has_sheet_enabled: true,
      sheet_price_monthly: 300,
    });

    // 3. Create default Owner and Staff accounts with bcrypt hash
    const rawOwnerPass = (typeof owner_password === "string" && owner_password.trim()) || "OwnerPass2026";
    const rawStaffPass = (typeof staff_password === "string" && staff_password.trim()) || "StaffPass2026";
    const [hashedOwner, hashedStaff] = await Promise.all([
      bcrypt.hash(rawOwnerPass, 10),
      bcrypt.hash(rawStaffPass, 10),
    ]);

    await supabase.from("library_users").insert([
      {
        library_id: newLib.id,
        username: "owner",
        password_hash: hashedOwner,
        role: "owner",
        full_name: `${name} Owner`,
      },
      {
        library_id: newLib.id,
        username: "staff",
        password_hash: hashedStaff,
        role: "staff",
        full_name: `${name} Desk Staff`,
      },
    ]);

    // 4. Pre-seed seats for this library
    const seatCount = Number(total_seats) || 50;
    const seatRows = Array.from({ length: seatCount }, (_, i) => ({
      library_id: newLib.id,
      seat_number: i + 1,
    }));
    await supabase.from("seats").insert(seatRows);

    return NextResponse.json({ success: true, library: newLib });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create library" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/libraries
 * SuperAdmin actions: Change monthly fee, extend subscription, update status
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, monthly_fee, subscription_status, subscription_ends_at, trial_ends_at, is_lifetime_fixed, discount_code } = body;

    if (!id) {
      return NextResponse.json({ error: "Library ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (monthly_fee !== undefined) updates.monthly_fee = Number(monthly_fee);
    if (subscription_status !== undefined) updates.subscription_status = subscription_status;
    if (subscription_ends_at !== undefined) updates.subscription_ends_at = subscription_ends_at;
    if (trial_ends_at !== undefined) updates.trial_ends_at = trial_ends_at;
    if (is_lifetime_fixed !== undefined) updates.is_lifetime_fixed = is_lifetime_fixed;
    if (discount_code !== undefined) updates.discount_code = discount_code;

    const { data, error } = await supabase
      .from("libraries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, library: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update library" },
      { status: 500 }
    );
  }
}
