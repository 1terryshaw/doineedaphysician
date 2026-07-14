import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { getTierByPriceId } from "@/lib/pricing-canonical";
import Stripe from "stripe";

/**
 * TDL #1041 — K36. supabase-js RETURNS { error }; it does not throw. It also returns NO error
 * for an UPDATE that matched ZERO rows (204, error=null), so the row count is the only signal
 * that the tier write actually landed on a listing.
 */
async function applyTierUpdate(
  values: Record<string, unknown>,
  column: string,
  value: string
): Promise<{ ok: true; rows: number } | { ok: false; reason: string }> {
  const { error, count } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .update(values, { count: "exact" })
    .eq(column, value);
  if (error) return { ok: false, reason: `db_error: ${error.message}` };
  return { ok: true, rows: count ?? 0 };
}

/** 500 => Stripe retries with backoff for up to 3 days, then surfaces the event as failed. */
function fail(event: Stripe.Event, reason: string) {
  console.error(`[stripe-webhook] FAILED ${event.type} ${event.id}: ${reason}`);
  return NextResponse.json(
    { error: "webhook_handler_failed", event: event.id, reason },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const listingSlug = session.metadata?.listingSlug;
      if (listingSlug && session.subscription && session.customer) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price?.id;
        const resolvedTier = priceId ? getTierByPriceId(priceId) : null;
        const w1 = await applyTierUpdate(
          {
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            tier: resolvedTier?.id || "claimed",
            subscription_tier: resolvedTier?.id || "free",
            updated_at: new Date().toISOString(),
          },
          "slug",
          listingSlug
        );
        if (!w1.ok) return fail(event, w1.reason);
        if (w1.rows === 0) return fail(event, `no listing matched slug=${listingSlug}`);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id;
      const matchedTier = priceId ? getTierByPriceId(priceId) : null;
      const w2 = await applyTierUpdate(
        {
          tier: matchedTier?.id || "claimed",
          subscription_tier: matchedTier?.id || "free",
          featured: matchedTier?.id === "website" || matchedTier?.id === "reviews_plus",
          updated_at: new Date().toISOString(),
        },
        "stripe_subscription_id",
        subscription.id
      );
      if (!w2.ok) return fail(event, w2.reason);
      if (w2.rows === 0) return fail(event, `no listing matched stripe_subscription_id=${subscription.id}`);
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const w3 = await applyTierUpdate(
        {
          tier: "claimed",
          subscription_tier: "free",
          featured: false,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        },
        "stripe_subscription_id",
        subscription.id
      );
      if (!w3.ok) return fail(event, w3.reason);
      if (w3.rows === 0) {
        console.warn(
          `[stripe-webhook] ${event.id} deleted: no listing on stripe_subscription_id=${subscription.id} (already downgraded).`
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
