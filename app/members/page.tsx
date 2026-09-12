"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import MembersView from "@/components/views/MembersView";

function LegacyMembersRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    router.replace(`/l/${encodeURIComponent(slug)}/members`);
  }, [searchParams, router]);

  return <MembersView />;
}

export default function LegacyMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LegacyMembersRedirect />
    </Suspense>
  );
}
