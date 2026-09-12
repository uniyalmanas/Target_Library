"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import NewReceiptView from "@/components/views/NewReceiptView";

function LegacyNewReceiptRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("slug");
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    router.replace(`/l/${encodeURIComponent(slug)}/new-receipt${query}`);
  }, [searchParams, router]);

  return <NewReceiptView />;
}

export default function LegacyNewReceiptPage() {
  return (
    <Suspense fallback={<p className="text-center py-10 text-xs text-text-muted">Loading admission form...</p>}>
      <LegacyNewReceiptRedirect />
    </Suspense>
  );
}
