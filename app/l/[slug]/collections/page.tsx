"use client";

import { use } from "react";
import CollectionsView from "@/components/views/CollectionsView";

export default function TenantCollectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <CollectionsView tenantSlug={slug} />;
}
