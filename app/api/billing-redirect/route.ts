import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerAccess } from '@/lib/auth';
import { signBillingHandoff } from '@/lib/billing-handoff';

export const dynamic = 'force-dynamic';

type Body = {
  listingSlug?: string;
  tier?: 'reviews_plus' | 'website' | 'growth' | 'website_receptionist';
  cycle?: 'monthly' | 'annual';
  mode?: 'trial' | 'direct' | 'preview' | 'buy';
};
const WEBSITE_TIERS = ['website', 'website_receptionist'];

export async function POST(request: NextRequest) {
  let body: Body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { listingSlug, tier, cycle, mode } = body;
  if (!listingSlug || !tier || !cycle) {
    return NextResponse.json({ error: 'Missing listingSlug, tier, or cycle' }, { status: 400 });
  }
  if (!['reviews_plus', 'website', 'growth', 'website_receptionist'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }
  // TDL #1374 (ruling R1): standalone Reviews Plus is retired for new customers on this host. Grandfathered owners keep
  // their existing subscription and manage it through the billing portal, never through a new checkout.
  if (tier === 'reviews_plus') {
    return NextResponse.json({ error: 'Reviews Plus is no longer sold' }, { status: 410 });
  }
  if (!['monthly', 'annual'].includes(cycle)) {
    return NextResponse.json({ error: 'Invalid cycle' }, { status: 400 });
  }
  // 'trial' is offered on reviews_plus and website only. Growth is
  // direct-purchase only; anything else (or absent) bills immediately.
  const checkoutMode: 'trial' | 'direct' =
    mode === 'trial' && tier === 'website'
      ? 'trial'
      : 'direct';
  // website-tiers-dualpath-stage-v1 (COO R1): a Website card's "buy now" is Path B (empire-billing sells now, builds, the owner approves
  // before publish); "preview first" (or anything else) stays Path A — the free preview request.
  const path: 'preview' | 'direct' | undefined = WEBSITE_TIERS.includes(tier) ? (mode === 'buy' ? 'direct' : 'preview') : undefined;

  const access = await verifyOwnerAccess(listingSlug);
  if (!access) {
    return NextResponse.json({ error: 'Not authorized for this listing' }, { status: 401 });
  }

  const listing = access.listing;
  const ownerEmail: string | undefined = listing.owner_email || listing.email;
  if (!ownerEmail || ownerEmail.trim() === '') {
    return NextResponse.json(
      { error: 'No owner email on file. Contact support.' },
      { status: 400 }
    );
  }

  let token: string;
  try {
    token = await signBillingHandoff({
      vertical: process.env.BILLING_VERTICAL_SLUG!,
      listing_slug: listingSlug,
      owner_email: ownerEmail,
      tier, cycle,
      mode: checkoutMode,
      ...(path ? { path } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Billing handoff signing failed' }, { status: 500 });
  }

  const billingBase = process.env.BILLING_SERVICE_URL;
  const vertical = process.env.BILLING_VERTICAL_SLUG!;
  if (!billingBase) {
    return NextResponse.json({ error: 'BILLING_SERVICE_URL not set' }, { status: 500 });
  }

  // Call billing service server-side and forward the response.
  // `mode` travels inside the signed handoff token — empire-billing reads it
  // from the verified payload, so it cannot be tampered with in transit.
  const url = `${billingBase}/api/checkout?token=${encodeURIComponent(token)}&vertical=${encodeURIComponent(vertical)}`;
  try {
    const billingRes = await fetch(url, { method: 'GET' });
    const text = await billingRes.text();
    let billingData;
    try { billingData = JSON.parse(text); }
    catch { return NextResponse.json({ error: 'Billing service returned invalid response', status: billingRes.status, body: text.slice(0, 200) }, { status: 502 }); }
    return NextResponse.json(billingData, { status: billingRes.status });
  } catch (e: any) {
    return NextResponse.json({ error: 'Billing service unreachable', detail: e.message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
