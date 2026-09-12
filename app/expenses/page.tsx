"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import ExpensesView from "@/components/views/ExpensesView";

function LegacyExpensesRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    const month = searchParams.get("month");
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    router.replace(`/l/${encodeURIComponent(slug)}/expenses${query}`);
  }, [searchParams, router]);

  return <ExpensesView />;
}

export default function LegacyExpensesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading expense ledger...</div>}>
      <LegacyExpensesRedirect />
    </Suspense>
  );
}
