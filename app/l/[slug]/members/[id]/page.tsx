"use client";

import { use } from "react";
import MemberProfileView from "@/components/views/MemberProfileView";

export default function TenantMemberProfilePage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  return <MemberProfileView tenantSlug={slug} memberId={id} />;
}
