"use client";

import { use } from "react";
import NewReceiptView from "@/components/views/NewReceiptView";

export default function TenantNewReceiptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <NewReceiptView tenantSlug={slug} />;
}
