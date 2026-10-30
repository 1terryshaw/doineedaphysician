// pricing-version: 2026-10-30-1362-ladder
// CANONICAL PRICING — single source of truth
// All directory pricing pages, UpgradeModal, and Stripe checkout flows import from here.
// DO NOT hardcode prices, tier names, or feature lists elsewhere.

export type TierId = 'verified' | 'reviews_plus' | 'website_basic' | 'website';

export interface CTA {
  label: string;
  /**
   * - 'trial' → Stripe Checkout with trial_period_days=30
   * - 'direct' → Stripe Checkout with no trial
   * - 'free' → no Stripe; activates free tier on claim
   * - 'preview' → no Stripe; requests a free website preview (owner login required)
   * - 'buy' → Website buy now: empire-billing Path B checkout (build → owner approves → publish)
   */
  mode: 'trial' | 'direct' | 'free' | 'preview' | 'buy';
}

export interface Tier {
  id: TierId;
  name: string;
  subtitle: string;
  priceMonthlyUSD: number;
  priceAnnualUSD: number;
  stripeProductId: string | null;
  stripePriceMonthlyId: string | null;
  stripePriceAnnualId: string | null;
  /** 5-6 bullets shown on the pricing card */
  visibleFeatures: string[];
  /** Additional features behind a "See all features" expand */
  expandedFeatures: string[];
  /** Primary CTA */
  cta: CTA;
  /** Secondary CTA (optional, for trial + direct purchase pattern) */
  secondaryCta?: CTA;
  /** Visually anchored on the card grid */
  anchored: boolean;
  /** Price is monthly only — no annual price; the annual toggle does not apply. */
  monthlyOnly?: boolean;
  /** Small print under the CTA. */
  footnote?: string;
  /** Tier slug sent to /api/billing-redirect when it differs from `id` (empire-billing's website plan slugs). */
  billingTier?: 'website' | 'website_receptionist';
  /** false = the annual price is shown but not on sale yet. */
  annualPurchasable?: boolean;
}

export const TIERS: Record<TierId, Tier> = {
  verified: {
    id: 'verified',
    name: 'Free',
    subtitle: 'Free forever — no credit card',
    priceMonthlyUSD: 0,
    priceAnnualUSD: 0,
    stripeProductId: null,
    stripePriceMonthlyId: null,
    stripePriceAnnualId: null,
    visibleFeatures: [
      '"Claimed" badge — becomes "Reviews verified" once your Google rating loads',
      'Contact info, hours, services displayed',
      'Up to 3 photos',
      'Star rating + Google review count',
      'Inquiry form sent to your email',
      'Custom description and service area',
    ],
    expandedFeatures: [],
    cta: { label: 'Claim Your Free Listing', mode: 'free' },
    anchored: false,
  },
  reviews_plus: {
    id: 'reviews_plus',
    name: 'Reviews Plus',
    subtitle: 'Most pros start here.',
    priceMonthlyUSD: 9,
    priceAnnualUSD: 90,
    stripeProductId: 'prod_UVCwwsGLZrCrFh',
    stripePriceMonthlyId: 'price_1TWCWhB4nhVx1nmU7e5wn3EI',
    stripePriceAnnualId: 'price_1TWCWhB4nhVx1nmU9rAwLlH0',
    visibleFeatures: [
      'Top reviews from Google displayed on your listing',
      '"Featured" badge (vs Claimed)',
      'Up to 10 photos + hero cover image',
      'Top-of-browse placement in directory search',
      'Listing health score in your dashboard',
      '"Welcome to Reviews Plus" PDF playbook',
    ],
    expandedFeatures: [
      'All Free features',
      'Recent Leads dashboard (existing inquiries to you, through the directory)',
      'Email lead alerts',
      'Weekly digest of activity',
    ],
    cta: { label: 'Start 30-Day Free Trial', mode: 'trial' },
    secondaryCta: { label: 'Skip trial, pay now — $9/mo', mode: 'direct' },
    anchored: true,
  },
  // fleet-pricing-ladder-audit-repair-v1 (TDL #1362): the approved ladder — Website $49 is the ENTRY website, Website + AI Receptionist $99 the UPGRADE.
  // Each: free preview first (Path A) or buy now (Path B, empire-billing sells; nothing goes live until the owner approves).
  // The $49 card lists only what this host delivers on the 'website' tier — never Leads Plus (not implemented on this host).
  website_basic: {
    id: 'website_basic',
    name: 'Website',
    subtitle: 'Your own website — start here',
    priceMonthlyUSD: 49,
    priceAnnualUSD: 490,
    annualPurchasable: true,
    stripeProductId: 'prod_UVCwbO2cUAURCF',
    stripePriceMonthlyId: 'price_1TjfMNB4nhVx1nmUtSlsXNFW',
    stripePriceAnnualId: 'price_1TjfMNB4nhVx1nmUQlFCiwyl',
    visibleFeatures: [
      'Top reviews from Google displayed on your listing',
      '"Featured" badge + top-of-browse placement',
      'Your own website, built for your business',
      'Mobile-friendly, fast, click-to-call',
      'See a free preview first — or buy now and we build it',
    ],
    expandedFeatures: [],
    cta: { label: 'See Your Free Preview', mode: 'preview' },
    secondaryCta: { label: 'Or buy now — $49/mo', mode: 'buy' },
    billingTier: 'website',
    footnote: 'Nothing goes live until you approve it. Buy now: not approved within 30 days of payment = cancelled + full refund. No contract. Cancel anytime.',
    anchored: false,
  },
  website: {
    id: 'website',
    name: 'Website + AI Receptionist',
    subtitle: 'The upgrade — your website plus an AI receptionist',
    priceMonthlyUSD: 99,
    priceAnnualUSD: 990,   // annual-v1: $990/yr = 10x monthly
    stripeProductId: 'prod_VMZoJGkrEewful',
    stripePriceMonthlyId: 'price_1ULqfAB4nhVx1nmU1g2yvHjs',
    stripePriceAnnualId: 'price_1UMVBvB4nhVx1nmUr3yDlPtU',
    visibleFeatures: [
      'Everything in Website, plus:',
      'Custom website built for your business, on your domain',
      'AI chat receptionist that answers visitors and emails you leads',
      'Mobile-friendly, fast, click-to-call',
      'Set up for Google in your city + service',
      'Small edits included every month',
    ],
    expandedFeatures: [],
    cta: { label: 'See Your Free Preview', mode: 'preview' },
    secondaryCta: { label: 'Or buy now — $99/mo', mode: 'buy' },
    billingTier: 'website_receptionist',
    footnote: 'Nothing goes live until you approve it. Buy now: not approved within 30 days of payment = cancelled + full refund. No contract. Cancel anytime.',
    anchored: false,
  },
};

/** Trial config — single source of truth */
export const TRIAL = {
  days: 30,
  /** Single notification day relative to trial end (one day before billing) */
  notifyDaysBeforeEnd: 1,
} as const;

/** Ordered tier list for rendering the card grid (left → right). */
// fleet-pricing-ladder-audit-repair-v1 (TDL #1362): R4 host — Leads Plus is barred here (R4: no lead forms), so the $9 Reviews Plus card stays pending a ruling.
export const TIER_ORDER: TierId[] = ['verified', 'reviews_plus', 'website_basic', 'website'];

/** Single source of truth: map a raw owner tier → the pricing-canonical tier id used by
 * current-plan comparison (currentTier === tier.id; the free tier id is "verified").
 * A claimed owner with no paid tier is on the free "Verified" plan; unclaimed/no-owner → null.
 * Normalizes the VALUE only — never touches owner-session detection or auth. */
export function normalizeTierForPricing(rawTier: string | null | undefined, claimed: boolean): string | null {
  if (rawTier === "reviews_plus" || rawTier === "website" || rawTier === "growth") return rawTier;
  return claimed ? "verified" : null;
}

/**
 * Legacy Growth price IDs — the Growth tier was removed per #596 (2026-06-18).
 * Resolve them explicitly to undefined so any stale handoff token degrades
 * gracefully. empire-billing's reverse map is the primary handler; this is a
 * layered defense.
 */
const LEGACY_GROWTH_PRICE_IDS: ReadonlySet<string> = new Set([
  'price_1TWCWiB4nhVx1nmUcfLKGTtR',
  'price_1TWCWjB4nhVx1nmUyZB92HW8',
]);

/** Look up a tier by a Stripe price ID (monthly or annual). */
export function getTierByPriceId(priceId: string): Tier | undefined {
  if (LEGACY_GROWTH_PRICE_IDS.has(priceId)) return undefined;
  return Object.values(TIERS).find(
    (t) => t.stripePriceMonthlyId === priceId || t.stripePriceAnnualId === priceId,
  );
}
