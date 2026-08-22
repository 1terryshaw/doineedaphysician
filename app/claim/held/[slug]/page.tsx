import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyOwnerAccess } from "@/lib/auth";
import verticalConfig from "@/lib/vertical.config";

// Stamper v8: this page reads the owner cookie + DB, so it must never be cached/statically rendered.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Ownership Verified",
};

interface Props {
  params: Promise<{ slug: string }>;
}

// Held-state signal page (republish-on-claim DENY). Reached only after claim/verify has confirmed
// ownership and set the owner auth cookie for a listing the republish guard did NOT republish. We
// re-gate on verifyOwnerAccess here so a held row's name is shown ONLY to its verified owner — never
// to an anonymous visitor who happens to know the slug (that would defeat the de-serve).
export default async function ClaimHeldPage({ params }: Props) {
  const { slug } = await params;
  const result = await verifyOwnerAccess(slug);

  // No valid owner session for this slug — do not reveal anything about the row.
  if (!result) {
    redirect("/owner/login");
  }

  const { listing } = result;
  const businessName =
    (listing.business_name as string | null) || (listing.name as string | null) || "your listing";
  const supportEmail = verticalConfig.supportEmail;

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-4">Ownership verified</h1>
      <p className="text-gray-700 mb-6">
        You&rsquo;ve verified ownership of <strong>{businessName}</strong>. This listing isn&rsquo;t
        publicly visible right now, and we&rsquo;ve recorded that you&rsquo;re the owner.
      </p>
      <p className="text-gray-700 mb-8">
        Reply to{" "}
        <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
          {supportEmail}
        </a>{" "}
        and we&rsquo;ll get it sorted.
      </p>
      <Link href="/" className="text-blue-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
