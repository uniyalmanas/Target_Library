"use client";

import { useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import MemberProfileView from "@/components/views/MemberProfileView";

function LegacyMemberProfileRedirect() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";
    if (id) {
      router.replace(`/l/${encodeURIComponent(slug)}/members/${id}`);
    }
  }, [id, searchParams, router]);

  return <MemberProfileView memberId={id} />;
}

export default function LegacyMemberProfilePage() {
  return (
    <Suspense fallback={<p className="text-neutral-400 text-center py-10">Loading member profile...</p>}>
      <LegacyMemberProfileRedirect />
    </Suspense>
  );
}
