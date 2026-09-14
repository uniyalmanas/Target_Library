import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_UPI_ID = process.env.NEXT_PUBLIC_SAAS_UPI_ID || "uniyalmanas@oksbi";
const DEFAULT_UPI_NAME = process.env.NEXT_PUBLIC_SAAS_UPI_NAME || "Manas Uniyal";
const DEFAULT_PHONE = "8535035757";

/**
 * GET /api/platform-config
 * Fetch the current SaaS founder UPI ID, Payee Name, and Phone
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("libraries")
      .select("upi_id, upi_name, phone, updated_at")
      .eq("slug", "platform-config")
      .single();

    if (error || !data) {
      return NextResponse.json({
        upi_id: DEFAULT_UPI_ID,
        upi_name: DEFAULT_UPI_NAME,
        phone: DEFAULT_PHONE,
        source: "default",
      });
    }

    return NextResponse.json({
      upi_id: data.upi_id || DEFAULT_UPI_ID,
      upi_name: data.upi_name || DEFAULT_UPI_NAME,
      phone: data.phone || DEFAULT_PHONE,
      updated_at: data.updated_at,
      source: "database",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        upi_id: DEFAULT_UPI_ID,
        upi_name: DEFAULT_UPI_NAME,
        phone: DEFAULT_PHONE,
        source: "fallback",
        error: err instanceof Error ? err.message : "Error loading config",
      },
      { status: 200 }
    );
  }
}

/**
 * PUT /api/platform-config
 * Founder SuperAdmin updates their SaaS receiver UPI ID, payee name, and phone
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { upi_id, upi_name, phone } = body;

    if (!upi_id || !upi_id.trim()) {
      return NextResponse.json(
        { error: "A valid UPI ID is required (e.g. uniyalmanas@oksbi)" },
        { status: 400 }
      );
    }

    const cleanUpiId = upi_id.trim();
    const cleanUpiName = upi_name?.trim() || "Manas Uniyal";
    const cleanPhone = phone?.trim() || "8535035757";

    const { data, error } = await supabase
      .from("libraries")
      .upsert(
        {
          slug: "platform-config",
          name: "LibraryOS Platform Settings",
          upi_id: cleanUpiId,
          upi_name: cleanUpiName,
          phone: cleanPhone,
          city: "Dehradun",
          monthly_fee: 0,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("upi_id, upi_name, phone, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Platform UPI configuration updated successfully! All QR codes now point to your new UPI ID.",
      config: {
        upi_id: data.upi_id,
        upi_name: data.upi_name,
        phone: data.phone,
        updated_at: data.updated_at,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update platform config" },
      { status: 500 }
    );
  }
}
