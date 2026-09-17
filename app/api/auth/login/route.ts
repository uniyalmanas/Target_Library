import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_SLUG, FALLBACK_TARGET_LIBRARY } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Body: { slug, role, password }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug = DEFAULT_LIBRARY_SLUG, role, password } = body;

    const cleanPassword = (password || "").trim();

    if (!role || !cleanPassword) {
      return NextResponse.json(
        { error: "Role and password are required" },
        { status: 400 }
      );
    }

    // 1. SuperAdmin (Founder) Master Passcode Detection
    const founderPass = process.env.FOUNDER_MASTER_PASSWORD || process.env.NEXT_PUBLIC_FOUNDER_PASSWORD || "Manas@12";
    const isFounderMasterPass = cleanPassword === founderPass || cleanPassword === "Manas@12";

    // SuperAdmin portal login
    if (role === "superadmin") {
      if (isFounderMasterPass) {
        return NextResponse.json({
          success: true,
          user: {
            role: "superadmin",
            username: "founder",
            fullName: "SaaS Platform Founder",
            slug: slug || "target-library",
            isMaster: true,
          },
        });
      }

      return NextResponse.json(
        { error: "Invalid SaaS Founder password" },
        { status: 401 }
      );
    }

    // 2. Master Founder Bypass: Founder can enter ANY library with zero friction
    if (isFounderMasterPass) {
      let resolvedLibName = slug;
      let resolvedLibId = "";
      try {
        const lib = await getLibraryBySlug(slug);
        resolvedLibName = lib.name;
        resolvedLibId = lib.id;
      } catch {
        // fallback
      }
      return NextResponse.json({
        success: true,
        user: {
          role: role === "staff" ? "staff" : "owner",
          username: "superadmin_master",
          fullName: `SuperAdmin (${resolvedLibName})`,
          libraryId: resolvedLibId,
          slug: slug,
          isMaster: role !== "staff",
        },
      });
    }

    // 3. Regular Library Tenant authentication (owner or staff)
    let library;
    if (slug === DEFAULT_LIBRARY_SLUG) {
      library = FALLBACK_TARGET_LIBRARY;
    } else {
      const { data: libData, error: libErr } = await supabase
        .from("libraries")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (libErr || !libData) {
        return NextResponse.json(
          { error: `Library "${slug}" is not registered on LibraryOS. Only registered libraries can sign in.` },
          { status: 404 }
        );
      }
      library = libData;
    }

    // Query library_users table in database for this library
    const { data: dbUsers } = await supabase
      .from("library_users")
      .select("*")
      .eq("library_id", library.id);

    const userList = Array.isArray(dbUsers) ? dbUsers : [];
    const ownerUser = userList.find((u) => u.role === "owner");
    const staffUser = userList.find((u) => u.role === "staff");

    const checkPassword = async (userRecord: any, expectedRole: "owner" | "staff") => {
      if (!userRecord || !userRecord.password_hash) return false;
      const storedHash = userRecord.password_hash;
      if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
        const matches = await bcrypt.compare(cleanPassword, storedHash);
        if (matches) return true;
      }
      const isPlain = storedHash === cleanPassword;
      if (isPlain) {
        bcrypt.hash(cleanPassword, 10).then((hashed) => {
          supabase.from("library_users").update({ password_hash: hashed }).eq("id", userRecord.id).then();
        }).catch(() => {});
        return true;
      }

      // Case-insensitive matching for standard fallback defaults
      const lower = cleanPassword.toLowerCase();
      const isDefaultFallback =
        expectedRole === "owner"
          ? lower === "targetowner2026" || lower === "ownerpass2026" || cleanPassword === (process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026")
          : lower === "target2026" || lower === "staffpass2026" || cleanPassword === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026");

      if (isDefaultFallback) {
        bcrypt.hash(cleanPassword, 10).then((hashed) => {
          supabase.from("library_users").update({ password_hash: hashed }).eq("id", userRecord.id).then();
        }).catch(() => {});
        return true;
      }

      return false;
    };

    // 1. Check Owner user in database (grants Owner role regardless of frontend toggle)
    if (ownerUser && (await checkPassword(ownerUser, "owner"))) {
      return NextResponse.json({
        success: true,
        user: {
          role: "owner",
          username: ownerUser.username,
          fullName: ownerUser.full_name || `${library.name} Owner`,
          libraryId: library.id,
          slug: library.slug,
          isMaster: false,
        },
      });
    }

    // 2. Check Staff user in database
    if (staffUser && (await checkPassword(staffUser, "staff"))) {
      return NextResponse.json({
        success: true,
        user: {
          role: "staff",
          username: staffUser.username,
          fullName: staffUser.full_name || `${library.name} Front Desk Staff`,
          libraryId: library.id,
          slug: library.slug,
          isMaster: false,
        },
      });
    }

    // 3. Fallback defaults if database accounts had hash discrepancies
    const lowerPass = cleanPassword.toLowerCase();
    const defaultOwnerPass = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    const defaultStaffPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Target2026";

    if (
      cleanPassword === defaultOwnerPass ||
      cleanPassword === "TargetOwner2026" ||
      lowerPass === "targetowner2026" ||
      lowerPass === "ownerpass2026"
    ) {
      if (ownerUser) {
        bcrypt.hash("TargetOwner2026", 10).then((hashed) => {
          supabase.from("library_users").update({ password_hash: hashed }).eq("id", ownerUser.id).then();
        }).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        user: {
          role: "owner",
          username: ownerUser?.username || "owner",
          fullName: ownerUser?.full_name || `${library.name} Owner`,
          libraryId: library.id,
          slug: library.slug,
          isMaster: false,
        },
      });
    }

    if (
      cleanPassword === defaultStaffPass ||
      cleanPassword === "Target2026" ||
      lowerPass === "target2026" ||
      lowerPass === "staffpass2026"
    ) {
      if (staffUser) {
        bcrypt.hash("Target2026", 10).then((hashed) => {
          supabase.from("library_users").update({ password_hash: hashed }).eq("id", staffUser.id).then();
        }).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        user: {
          role: "staff",
          username: staffUser?.username || "staff",
          fullName: staffUser?.full_name || `${library.name} Front Desk Staff`,
          libraryId: library.id,
          slug: library.slug,
          isMaster: false,
        },
      });
    }

    return NextResponse.json(
      { error: "Incorrect passcode. Please verify your password." },
      { status: 401 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication error" },
      { status: 500 }
    );
  }
}
