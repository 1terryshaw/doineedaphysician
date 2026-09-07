// HUB OCCUPANCY GATE — empty-city-hubs-fan-v1 (2026-09-07). See K200.
//
// A known-but-empty hub must 404, not render an indexable "No physicians in X yet" at
// HTTP 200. The gate needs a count that FAILS LOUD: the hub reads in lib/supabase.ts
// swallow their errors and return [] / 0, so gating on those would turn a transient DB
// fault into a 404 on every live province hub at once.
//
// Own module so lib/supabase.ts is untouched. Same client, same row boundary
// (country + is_published) as getListingsByProvincePaged.
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";

// Next's prerender bailout is NOT a DB fault and NOT evidence of zero rows: a
// `cache: "no-store"` fetch inside a prerender raises DynamicServerError, and
// supabase-js catches it and returns it as an ordinary `{ error }`. Return null
// ("unknown") so the caller skips the gate; a real query error still throws. (This
// route is force-dynamic today, so the path is defensive — but it cost a failed build
// on doineedacupuncture, whose route is not.)
const PRERENDER_BAILOUT = /Dynamic server usage|DYNAMIC_SERVER_USAGE/;

export async function provinceRowCount(provinceCode: string): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*", { count: "exact", head: true })
    .in("country", ["CA", "US"])
    .neq("is_published", false)
    .eq("province_state", provinceCode.toUpperCase());
  if (error) {
    const message = String((error as { message?: unknown })?.message ?? "");
    if (PRERENDER_BAILOUT.test(message)) return null;
    // Throw, never 0 — see the note above.
    throw new Error(`provinceRowCount(${provinceCode}) failed: ${message || "unknown"}`);
  }
  return count || 0;
}
