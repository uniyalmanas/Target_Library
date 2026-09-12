import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * PUT /api/libraries/[slug]/staff-password
 * Allows the Library Owner to change the staff passcode or their own owner passcode
 * Body: { target_role: 'staff' | 'owner', new_password }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const library = await getLibraryBySlug(slug);
    const body = await req.json();
    const { target_role = "staff", new_password } = body;

    if (!new_password || !new_password.trim()) {
      return NextResponse.json(
        { error: "New password cannot be empty" },
        { status: 400 }
      );
    }

    const cleanPassword = new_password.trim();
    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    // 1. Check if user row exists
    const { data: existingUser } = await supabase
      .from("library_users")
      .select("id")
      .eq("library_id", library.id)
      .eq("role", target_role)
      .maybeSingle();

    if (existingUser) {
      // Update existing password
      const { error: updateErr } = await supabase
        .from("library_users")
        .update({
          password_hash: hashedPassword,
          created_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id);

      if (updateErr) throw updateErr;
    } else {
      // Insert new account record
      const { error: insertErr } = await supabase
        .from("library_users")
        .insert({
          library_id: library.id,
          username: target_role,
          password_hash: hashedPassword,
          role: target_role,
          full_name: `${library.name} ${target_role === "owner" ? "Owner" : "Desk Staff"}`,
          is_active: true,
        });

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({
      success: true,
      message: `${target_role === "staff" ? "Staff" : "Owner"} password updated successfully!`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update password" },
      { status: 500 }
    );
  }
}
