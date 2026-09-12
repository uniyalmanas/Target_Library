"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import DueFeesView from "@/components/views/DueFeesView";

function LegacyDueFeesRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    router.replace(`/l/${encodeURIComponent(slug)}/due-fees`);
  }, [searchParams, router]);

  return <DueFeesView />;
}

export default function LegacyDueFeesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading due fees register...</div>}>
      <LegacyDueFeesRedirect />
    </Suspense>
  );
}
