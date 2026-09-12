import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_SLUG } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body: { slug, role, password }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug = DEFAULT_LIBRARY_SLUG, role, password } = body;

    if (!role || !password) {
      return NextResponse.json(
        { error: "Role and password are required" },
        { status: 400 }
      );
    }

    // 1. SuperAdmin (Founder) authentication
    if (role === "superadmin") {
      const founderPass = process.env.NEXT_PUBLIC_FOUNDER_PASSWORD || process.env.NEXT_PUBLIC_OWNER_PASSWORD || "Founder2026";
      const validAdmin = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

      if (password === founderPass || password === validAdmin || password === "Founder2026" || password === "TargetOwner2026") {
        return NextResponse.json({
          success: true,
          user: {
            role: "superadmin",
            username: "founder",
            fullName: "SaaS Platform Founder",
            slug: "target-library",
          },
        });
      }

      return NextResponse.json(
        { error: "Invalid SaaS Founder password" },
        { status: 401 }
      );
    }

    // 2. Library Tenant authentication (owner or staff)
    const library = await getLibraryBySlug(slug);

    // Query library_users table in database
    const { data: dbUser, error: userErr } = await supabase
      .from("library_users")
      .select("*")
      .eq("library_id", library.id)
      .eq("role", role)
      .maybeSingle();

    if (!userErr && dbUser) {
      if (dbUser.password_hash === password) {
        return NextResponse.json({
          success: true,
          user: {
            role: dbUser.role,
            username: dbUser.username,
            fullName: dbUser.full_name || `${library.name} ${role}`,
            libraryId: library.id,
            slug: library.slug,
          },
        });
      }
    }

    // Fallback defaults for Target Library if not customized yet
    if (slug === DEFAULT_LIBRARY_SLUG) {
      const defaultOwnerPass = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
      const defaultStaffPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

      if (role === "owner" && (password === defaultOwnerPass || password === "TargetOwner2026")) {
        return NextResponse.json({
          success: true,
          user: {
            role: "owner",
            username: "owner",
            fullName: `${library.name} Owner`,
            libraryId: library.id,
            slug: library.slug,
          },
        });
      }

      if (role === "staff" && (password === defaultStaffPass || password === "target2026" || password === "Target2026")) {
        return NextResponse.json({
          success: true,
          user: {
            role: "staff",
            username: "staff",
            fullName: `${library.name} Front Desk Staff`,
            libraryId: library.id,
            slug: library.slug,
          },
        });
      }
    }

    return NextResponse.json(
      { error: `Incorrect password for ${role === "owner" ? "Library Owner" : "Desk Staff"}` },
      { status: 401 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}
