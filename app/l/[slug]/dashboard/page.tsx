"use client";

import { use } from "react";
import DashboardView from "@/components/views/DashboardView";

export default function TenantDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <DashboardView tenantSlug={slug} />;
}
