import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Metadata } from "next";
import { verifyOwnerAccess } from "@/lib/auth";
import OwnerDashboard from "@/components/OwnerDashboard";
import { parseUpgradeIntent, intentFromCookie, intentQuery, UPGRADE_INTENT_COOKIE } from "@/lib/upgrade-intent";
import UpgradeIntentLauncher from "@/components/UpgradeIntentLauncher";
import HealthLeadsPlusPanel from "@/components/HealthLeadsPlusPanel";
import { healthLpRule, verticalAllowsLeadForms, ineligibleText } from "@/lib/health-leads-plus";
import ReviewShowcase from "@/components/ReviewShowcase";
import HealthScore from "@/components/HealthScore";
import { listPhotosForListing } from "@/lib/listing-photos";
import { computeListingHealth } from "@/lib/listing-health";
import NextStepCard from "@/components/NextStepCard";
import SavedNotice from "@/components/SavedNotice";
import { deriveNextStep } from "@/lib/owner-next-step";
import { addressEditClass, addressEditAllowed } from "@/lib/owner-location-edit";
import ReviewKit from "@/components/ReviewKit";
import { buildReviewKit, reviewKitPlaceId } from "@/lib/review-kit";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner Dashboard",
};

export default async function OwnerDashboardPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const saved = sp.saved === "1"; // owner-journey-friction-fix-v1
  // TDL #1391 (K432 rule 4): the owner's Leads Plus choice survives the login / claim round trip (URL, then lp_intent cookie).
  const spGet = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const intent = parseUpgradeIntent(spGet) ?? intentFromCookie((await cookies()).get(UPGRADE_INTENT_COOKIE)?.value);
  const result = await verifyOwnerAccess(slug);

  if (!result) {
    redirect(intent ? `/owner/login?${intentQuery(intent)}` : "/owner/login");
  }

  const { listing } = result;
  const lst = listing as typeof listing & {
    google_place_id?: string;
    google_rating?: number;
    google_review_count?: number;
  };
  const reviewSlot = lst.google_place_id ? (
    <ReviewShowcase
      googlePlaceId={lst.google_place_id}
      subscriptionTier={
        (listing.subscription_tier || listing.tier || "free") as
          | "free"
          | "reviews_plus"
          | "reviews"
          | "website"
          | "growth"
      }
      fallbackRating={lst.google_rating}
      fallbackCount={lst.google_review_count}
    />
  ) : null;

  const { photos } = await listPhotosForListing(listing.id);
  const healthSlot = (
    <HealthScore health={computeListingHealth(listing, photos.length)} />
  );

  // owner-next-step-card-canary-v1: one action, derived read-only from this row.
  const row = listing as Record<string, unknown>;
  // owner-canary-fixes-and-review-kit-v1: the review kit, for a Google-connected (ChIJ) row only.
  const kitPlaceId = reviewKitPlaceId(row.google_place_id as string | null);
  const reviewKit = kitPlaceId ? buildReviewKit(kitPlaceId) : null;
  const nextStep = deriveNextStep(
    {
      slug: listing.slug,
      phone: row.phone as string | null,
      website: row.website as string | null,
      hours_json: row.hours_json,
      description: row.description as string | null,
      address: row.address as string | null,
      show_address: row.show_address as boolean | null,
      google_place_id: row.google_place_id as string | null,
      google_review_count: row.google_review_count as number | null,
    },
    photos.length,
    {
      addressEditable: addressEditAllowed(await addressEditClass(row.source as string | null)),
      photosSupported: true,
      reviewKit: !!reviewKit,
    },
  );

  // TDL #1391: Leads Plus (health) — purchase state from leads_plus_enabled (empire-billing writes only that flag here),
  // availability from the rules table (public.health_lp_listing_eligible).
  const lpRule = verticalAllowsLeadForms() ? await healthLpRule(listing.slug) : { eligible: false, reason: "not_offered" };
  const lpActive = (listing as Record<string, unknown>).leads_plus_enabled === true && lpRule.eligible === true;
  const lpState: "active" | "available" | "unavailable" = lpActive ? "active" : lpRule.eligible ? "available" : "unavailable";
  const launch = intent && lpState === "available" ? intent : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {launch && <UpgradeIntentLauncher listingSlug={listing.slug} mode={launch.mode} skip={false} />}
      <HealthLeadsPlusPanel slug={listing.slug} state={lpState} reason={lpState === "unavailable" ? ineligibleText(lpRule.reason) : undefined} />
      <OwnerDashboard
        listing={listing}
        reviewSlot={reviewSlot}
        healthSlot={healthSlot}
        nextStepSlot={
          <>
            {saved && <SavedNotice />}
            <NextStepCard step={nextStep} />
            {reviewKit && <ReviewKit kit={reviewKit} slug={listing.slug} />}
          </>
        }
      />
    </div>
  );
}
