/**
 * Creates Stripe products and prices for directory listing tiers.
 * Run: npx ts-node scripts/create-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY in .env.local
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const tiers = [
  { name: "Pro", price: 2900, description: "Claimed & verified physician listing" },
  { name: "Premium", price: 4900, description: "Featured physician listing with Instagram promotion" },
  { name: "Growth", price: 9700, description: "Top placement physician listing with promotion package" },
];

async function main() {
  console.log("Creating Stripe products and prices...\n");

  for (const tier of tiers) {
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.price,
      currency: "cad",
      recurring: { interval: "month" },
    });

    console.log(`${tier.name}:`);
    console.log(`  Product ID: ${product.id}`);
    console.log(`  Price ID:   ${price.id}`);
    console.log(`  Amount:     $${tier.price / 100}/month\n`);
  }

  console.log("Done! Paste the Price IDs into lib/pricing.ts");
}

main().catch(console.error);
