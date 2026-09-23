export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { HOME_LISTINGS_TAG } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";

// Admin-only on-demand cache-bust. Guarded by a dedicated REVALIDATE_SECRET
// Bearer token (fail-closed if unset) -- NOT public. Stamped by
// homeisr-purge-stamp-v1 (TDL #1262 / #1244): this repo's home page became ISR
// in the #1244 fan and had NO purge path, so a claim or a publish left `/` up to
// an hour stale with no way to evict it.
//
// Purges every expression of a listing's cached identity that EXISTS in THIS repo:
//   1. revalidateTag(`listing:${slug}`)                  -- the unstable_cache row tag
//      (inert here: this repo has no unstable_cache producer; kept for fleet parity)
//      (this repo calls no getEnrichment(), so there is no enrichment tag to purge
//       and stamping one with a guessed vertical would purge nothing)
//   2. revalidatePath(`/directory/${slug}`)              -- the rendered detail page
//   3. the HOME PAGE, which the #1244 fan made ISR -- see the end of POST()
//
// revalidatePath is the load-bearing one for ISR: a tag purge cannot evict a
// prerendered page that never read that tag. A LITERAL path with NO `type`
// argument is required -- revalidatePath(path, "page") emits `_N_T_/<path>/page`,
// which matches nothing (K32). Do not add a type argument.
//
// CROSS-MAJOR: revalidateTag's signature differs by Next major -- 14 takes (tag), 16
// takes (tag, profile). This repo is on Next 14, but the cast keeps the file portable
// to a 16 bump, where a bare 1-arg call is a hard TS2554 build failure.
//
// Body: { slugs: string[] }
const purgeTag = revalidateTag as unknown as (tag: string, profile?: { expire: number }) => void;

const MAX_SLUGS = 1000;

// `_` MUST be permitted -- most fleet slugs carry a source-tag segment like
// `-tx_bar_2026_05_14-`. No `/`, `.`, space or `%` is accepted, so the value can
// never escape the `/directory/` segment.
const SLUG_RE = /^[A-Za-z0-9_-]{1,200}$/;

function authorized(request: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return false; // fail closed
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = (body as { slugs?: unknown })?.slugs;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "slugs[] required" }, { status: 400 });
  }
  if (raw.length === 0) {
    return NextResponse.json({ error: "slugs[] must contain at least one non-empty string" }, { status: 400 });
  }
  if (raw.length > MAX_SLUGS) {
    return NextResponse.json({ error: `too many slugs (max ${MAX_SLUGS})` }, { status: 400 });
  }
  const invalid = raw.filter((s) => typeof s !== "string" || !SLUG_RE.test(s));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `invalid slug(s): ${invalid.slice(0, 5).map(String).join(", ")}${invalid.length > 5 ? ` (+${invalid.length - 5} more)` : ""}` },
      { status: 400 }
    );
  }
  const slugs = raw as string[];

  const errors: string[] = [];
  let revalidated = 0;
  for (const slug of slugs) {
    try {
      purgeTag(`listing:${slug}`, { expire: 0 });
      revalidatePath(`/directory/${slug}`);
      revalidated++;
    } catch (e) {
      errors.push(`${slug}: ${(e as Error)?.message || "unknown"}`);
    }
  }

  // THE HOME PAGE. `/` is ISR since the #1244 fan, so a claim or a publish changes
  // what it shows and purging only /directory/<slug> would leave it up to an hour
  // stale about a listing whose detail page was just corrected. Fired ONCE per
  // call, after the per-slug loop -- not once per slug.
  try {
    // THE TAG ONLY. Do NOT add revalidatePath("/") here -- MEASURED 2026-09-22, it
    // purges the WHOLE ROUTE TREE, not the root page.
    //
    //   doineedadrivinginstructor, revalidateTag(HOME) + revalidatePath("/"):
    //     /uk/bedford  HIT age 12 -> REVALIDATED   <-- evicted, and it neither reads
    //     /uk/belfast  HIT age 12 -> REVALIDATED       the tag nor uses that client
    //   doineedatutor, revalidateTag(HOME) alone:
    //     /                 HIT age 3503  -> REVALIDATED   <-- evicted, correctly
    //     /uk/aberdeenshire HIT age 19252 -> HIT age 19261  <-- untouched
    //
    // NOTE the Next docs say the opposite: an untyped literal path "will invalidate one
    // specific path", and `revalidatePath("/", "layout")` is given as the way to purge
    // everything. On Next 14.2.35 the untyped call at "/" behaves like the layout form.
    // The mechanism is not asserted here -- the MEASUREMENT is, with a no-purge control
    // (90s, both pages HIT, age climbing 213->289, never REVALIDATED) and a third page
    // never warmed in that cycle (/uk/bolton) evicted too. Do not "correct" this comment
    // from the docs without re-running that control.
    //
    // K32's "literal path, NO type argument" rule was measured on /directory/<slug>,
    // where the layout is a leaf. It does not carry to the root.
    //
    // This is not a correctness bug -- everything regenerates -- it is a COST and
    // STABILITY one: a claim-triggered purge would dump the entire site's ISR cache
    // and stampede the shared Supabase instance, which is already OOM-restarting
    // under RAM pressure (TDL #1244). The tag is precise and provably sufficient.
    purgeTag(HOME_LISTINGS_TAG, { expire: 0 });
  } catch (e) {
    errors.push(`home: ${(e as Error)?.message || "unknown"}`);
  }

  return NextResponse.json({ revalidated, home: true, errors });
}
