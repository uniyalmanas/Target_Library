import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/libraries/[slug]/student?phone=9876543210
 * Returns student profile, assigned seat, current active subscription, receipts,
 * or pending entrance door admission status.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const library = await getLibraryBySlug(slug);
    const { searchParams } = new URL(req.url);
    const rawPhone = searchParams.get("phone")?.trim();

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Please provide a valid 10-digit phone number" },
        { status: 400 }
      );
    }

    const cleanPhone = rawPhone.replace(/\D/g, ""); // digits only

    // 1. Search in members table by phone
    const { data: members, error: memErr } = await supabase
      .from("members")
      .select("*, receipts(*, seats(seat_number))")
      .eq("library_id", library.id)
      .or(`phone.eq.${cleanPhone},phone.ilike.%${cleanPhone}%`)
      .order("student_id", { ascending: false });

    if (memErr) {
      console.error("Error querying members:", memErr);
    }

    let member = members && members.length > 0 ? members[0] : null;

    // 2. If member not found by cleanPhone, check by rawPhone or aadhar_no
    if (!member) {
      const { data: fallbackMembers } = await supabase
        .from("members")
        .select("*, receipts(*, seats(seat_number))")
        .eq("library_id", library.id)
        .or(`phone.ilike.%${rawPhone}%,aadhar_no.eq.${cleanPhone}`)
        .limit(1);

      if (fallbackMembers && fallbackMembers.length > 0) {
        member = fallbackMembers[0];
      }
    }

    // 3. Search for pending admission requests if student just paid via entrance QR
    const { data: pendingAdmissions } = await supabase
      .from("admission_requests")
      .select("*")
      .eq("library_id", library.id)
      .or(`student_phone.eq.${cleanPhone},student_phone.ilike.%${cleanPhone}%`)
      .order("created_at", { ascending: false })
      .limit(3);

    // If member exists, extract latest seat and active receipt
    let activeSeat: { seat_number: number; seat_id: number } | null = null;
    let latestReceipt: any = null;
    let daysRemaining = 0;
    let status: "active" | "expiring_soon" | "expired" | "pending_verification" | "not_found" = "not_found";

    if (member) {
      // Find non-vacated receipts sorted by created_at / start_date
      const memberReceipts = (member.receipts || []).sort(
        (a: any, b: any) => new Date(b.created_at || b.start_date).getTime() - new Date(a.created_at || a.start_date).getTime()
      );

      if (memberReceipts.length > 0) {
        latestReceipt = memberReceipts[0];
        if (latestReceipt.seats) {
          activeSeat = {
            seat_number: latestReceipt.seats.seat_number,
            seat_id: latestReceipt.seat_id,
          };
        }

        const endDate = new Date(latestReceipt.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = endDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (latestReceipt.is_vacated || daysRemaining < 0) {
          status = "expired";
        } else if (daysRemaining <= 3) {
          status = "expiring_soon";
        } else {
          status = "active";
        }
      } else {
        status = "active";
      }
    } else if (pendingAdmissions && pendingAdmissions.length > 0) {
      status = "pending_verification";
    }

    let librarySettings = null;
    try {
      librarySettings = await getLibrarySettings(library.id);
    } catch {
      // fallback
    }

    return NextResponse.json({
      success: true,
      library: {
        id: library.id,
        name: library.name,
        slug: library.slug,
        city: library.city,
        phone: library.phone,
        address: library.address,
        logo_url: library.logo_url,
      },
      settings: librarySettings,
      member: member
        ? {
            student_id: member.student_id,
            name: member.name,
            phone: member.phone,
            aadhar_no: member.aadhar_no,
            date_of_joining: member.date_of_joining,
            created_at: member.created_at,
          }
        : null,
      activeSeat,
      latestReceipt,
      receipts: member?.receipts || [],
      pendingAdmissions: pendingAdmissions || [],
      daysRemaining,
      status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load student pass" },
      { status: 500 }
    );
  }
}
