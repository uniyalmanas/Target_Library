import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_UPI_ID = process.env.NEXT_PUBLIC_SAAS_UPI_ID || "uniyalmanas@oksbi";
const DEFAULT_UPI_NAME = process.env.NEXT_PUBLIC_SAAS_UPI_NAME || "Manas Uniyal";
const DEFAULT_PHONE = "8535035757";
const DEFAULT_LOGO_URL = "/libraryos-logo.png";

/**
 * GET /api/platform-config
 * Fetch the current SaaS founder UPI ID, Payee Name, Phone, and Platform Logo
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("libraries")
      .select("upi_id, upi_name, phone, logo_url, updated_at")
      .eq("slug", "platform-config")
      .single();

    if (error || !data) {
      return NextResponse.json({
        upi_id: DEFAULT_UPI_ID,
        upi_name: DEFAULT_UPI_NAME,
        phone: DEFAULT_PHONE,
        logo_url: DEFAULT_LOGO_URL,
        source: "default",
      });
    }

    return NextResponse.json({
      upi_id: data.upi_id || DEFAULT_UPI_ID,
      upi_name: data.upi_name || DEFAULT_UPI_NAME,
      phone: data.phone || DEFAULT_PHONE,
      logo_url: data.logo_url || DEFAULT_LOGO_URL,
      updated_at: data.updated_at,
      source: "database",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        upi_id: DEFAULT_UPI_ID,
        upi_name: DEFAULT_UPI_NAME,
        phone: DEFAULT_PHONE,
        logo_url: DEFAULT_LOGO_URL,
        source: "fallback",
        error: err instanceof Error ? err.message : "Error loading config",
      },
      { status: 200 }
    );
  }
}

/**
 * PUT /api/platform-config
 * Founder SuperAdmin updates their SaaS receiver UPI ID, payee name, phone, or platform logo
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { upi_id, upi_name, phone, logo_url } = body;

    // Fetch existing settings if any fields are omitted
    const { data: existing } = await supabase
      .from("libraries")
      .select("upi_id, upi_name, phone, logo_url")
      .eq("slug", "platform-config")
      .single();

    const cleanUpiId = (upi_id && upi_id.trim()) || existing?.upi_id || DEFAULT_UPI_ID;
    const cleanUpiName = upi_name?.trim() || existing?.upi_name || DEFAULT_UPI_NAME;
    const cleanPhone = phone?.trim() || existing?.phone || DEFAULT_PHONE;
    const cleanLogoUrl = logo_url !== undefined ? logo_url : (existing?.logo_url || DEFAULT_LOGO_URL);

    const { data, error } = await supabase
      .from("libraries")
      .upsert(
        {
          slug: "platform-config",
          name: "LibraryOS Platform Settings",
          upi_id: cleanUpiId,
          upi_name: cleanUpiName,
          phone: cleanPhone,
          logo_url: cleanLogoUrl,
          city: "Dehradun",
          monthly_fee: 0,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("upi_id, upi_name, phone, logo_url, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Platform configuration updated successfully!",
      config: {
        upi_id: data.upi_id,
        upi_name: data.upi_name,
        phone: data.phone,
        logo_url: data.logo_url,
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
