"use client";

import { use } from "react";
import MembersView from "@/components/views/MembersView";

export default function TenantMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <MembersView tenantSlug={slug} />;
}
