"use client";

import { use } from "react";
import DueFeesView from "@/components/views/DueFeesView";

export default function TenantDueFeesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <DueFeesView tenantSlug={slug} />;
}
