"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import CollectionsView from "@/components/views/CollectionsView";

function LegacyCollectionsRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    const date = searchParams.get("date");
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    router.replace(`/l/${encodeURIComponent(slug)}/collections${query}`);
  }, [searchParams, router]);

  return <CollectionsView />;
}

export default function LegacyDailyCollectionsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading collections ledger...</div>}>
      <LegacyCollectionsRedirect />
    </Suspense>
  );
}
