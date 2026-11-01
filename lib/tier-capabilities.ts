/**
 * Tier capability map + helpers.
 * Single source of truth for what each tier actually unlocks in the app.
 * Marketing copy lives in lib/pricing.ts; enforcement logic lives here.
 */

export type TierSlug =
  | "seed"
  | "free"
  | "reviews_plus"
  | "website"
  | "growth"
  | "payment_error_review";

export type Capability =
  | "lead_forwarding"
  | "reviews_display"
  | "featured"
  | "analytics"
  | "priority_search"
  | "siteforge"
  | "custom_domain";

type CapabilityMap = Record<Capability, boolean>;

// TDL #1393 (K438 Rule 1, health-ranking-neutrality-and-tail-v1): this is a HEALTH directory. No paid tier of any
// kind (Reviews Plus / Leads Plus / Website / Website + Receptionist / Growth / grandfathered) may buy placement or a
// badge that implies endorsement, so "featured" and "priority_search" are false on every tier. Paid features stay.
// The sort keys themselves are neutral in the DB (public.health_neutral_rank_keys trigger: tier_priority = claimed?1:0,
// featured frozen), so this map only governs the badge.
export const TIER_CAPABILITIES: Record<TierSlug, CapabilityMap> = {
  seed: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  free: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  reviews_plus: {
    lead_forwarding: true,
    reviews_display: true,
    featured: false,
    analytics: true,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
  website: {
    lead_forwarding: true,
    reviews_display: true,
    featured: false,
    analytics: true,
    priority_search: false,
    siteforge: true,
    custom_domain: false,
  },
  growth: {
    lead_forwarding: true,
    reviews_display: true,
    featured: false,
    analytics: true,
    priority_search: false,
    siteforge: true,
    custom_domain: true,
  },
  payment_error_review: {
    lead_forwarding: false,
    reviews_display: false,
    featured: false,
    analytics: false,
    priority_search: false,
    siteforge: false,
    custom_domain: false,
  },
};

/**
 * Check if a tier has a capability. Safe on null/undefined/unknown input —
 * returns false rather than throwing.
 */
// Backward compat: DB may still have "reviews" until CHECK constraint is updated
const TIER_ALIASES: Record<string, TierSlug> = {
  reviews: "reviews_plus",
  claimed: "free",
};

export function can(
  tier: TierSlug | string | null | undefined,
  capability: Capability
): boolean {
  if (!tier) return false;
  const resolved = TIER_ALIASES[tier] || tier;
  const caps = TIER_CAPABILITIES[resolved as TierSlug];
  if (!caps) return false;
  return caps[capability] === true;
}

/**
 * The tier that actually governs entitlements: the paid `subscription_tier` when present,
 * else the operational `tier` column. (Mirrors getapro / the #472 guard.)
 */
export function getEffectiveTier(
  listing: { tier?: string | null; subscription_tier?: string | null }
): string {
  const sub = listing.subscription_tier;
  if (sub && sub !== "free") return sub;
  return listing.tier || "free";
}

/**
 * Public-facing tier label.
 * `seed` and `payment_error_review` both show as "Free" to end users.
 */
export function getTierDisplayName(
  tier: TierSlug | string | null | undefined
): "Free" | "Reviews Plus" | "Website" | "Growth" {
  const t = TIER_ALIASES[tier as string] || tier;
  switch (t) {
    case "reviews_plus":
      return "Reviews Plus";
    case "website":
      return "Website";
    case "growth":
      return "Growth";
    default:
      return "Free";
  }
}

/**
 * Upgrade-path helper (billing-ledger-and-nexttier-fix-v1). A free / claimed listing's next tier is what THIS host sells a
 * NEW customer: Leads Plus where the host's Leads Plus gate is open, else the cheapest Website plan its upgrade modal sells,
 * else none (no upgrade link). Never Reviews Plus — it is retired for new customers (R11 / TDL #1374).
 * Paid tiers (grandfathered owners) are unchanged: reviews_plus → website, website → growth, growth → null.
 * `offer` comes from the owner page (server side, the same gates checkout uses); omitted ⇒ nothing is known to be on sale.
 */
export type HostOffer = { leadsPlus: boolean; website: boolean; leadsPlusHref?: string };
export type NextTier = TierSlug | "leads_plus";

export function getNextTier(
  currentTier: TierSlug | string | null | undefined,
  offer: HostOffer = { leadsPlus: false, website: false }
): NextTier | null {
  const ct = TIER_ALIASES[currentTier as string] || currentTier;
  switch (ct) {
    case "reviews_plus":
      return "website";
    case "website":
      return "growth";
    case "growth":
      return null;
    default:
      // seed / free / claimed / payment_error_review / unknown — a new customer.
      return offer.leadsPlus ? "leads_plus" : offer.website ? "website" : null;
  }
}

/** Label for a getNextTier result ("leads_plus" is not a stored tier, so getTierDisplayName would alias it to Reviews Plus). */
export function getNextTierLabel(t: NextTier): string {
  return t === "leads_plus" ? "Leads Plus" : getTierDisplayName(t);
}

/**
 * Sort priority for search/category listings.
 * Higher number = shown first. Paid tiers outrank free.
 */
export function getTierPriority(
  tier: TierSlug | string | null | undefined
): number {
  const t = TIER_ALIASES[tier as string] || tier;
  switch (t) {
    case "growth":
      return 4;
    case "website":
      return 3;
    case "reviews_plus":
      return 2;
    case "free":
    case "payment_error_review":
      return 1;
    case "seed":
    default:
      return 0;
  }
}
