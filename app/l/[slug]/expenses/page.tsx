"use client";

import { use } from "react";
import ExpensesView from "@/components/views/ExpensesView";

export default function TenantExpensesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <ExpensesView tenantSlug={slug} />;
}
