// Server-side helpers for the shared listing_photos table + storage bucket.
// Both kinds (photo, logo) share the same table; the photo_kind column
// distinguishes them. App-layer enforces max-3 photos and max-1 logo via
// nextPhotoSlot() / existingLogoId() — DB also has chk_display_order(0..2).

import { supabaseAdmin } from "@/lib/supabase";
import { ListingPhoto, MAX_PHOTOS } from "@/lib/listing-extras";
import { VERTICAL_KEY } from "@/lib/vertical-canonical";

export const PHOTO_BUCKET = "listing-photos";
export { VERTICAL_KEY };

export type PhotoKind = "photo" | "logo";

interface PhotoRow {
  id: string;
  public_url: string;
  display_order: number;
  photo_kind: PhotoKind;
  storage_path: string;
}

export async function listPhotosForListing(listingId: string): Promise<{
  photos: ListingPhoto[];
  logo: ListingPhoto | null;
}> {
  const { data, error } = await supabaseAdmin
    .from("listing_photos")
    .select("id, public_url, display_order, photo_kind, storage_path")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (error || !data) return { photos: [], logo: null };

  const photos: ListingPhoto[] = [];
  let logo: ListingPhoto | null = null;
  for (const r of data as PhotoRow[]) {
    const item: ListingPhoto = {
      id: r.id,
      public_url: r.public_url,
      display_order: r.display_order,
      photo_kind: r.photo_kind,
    };
    if (r.photo_kind === "logo") {
      if (!logo) logo = item;
    } else {
      photos.push(item);
    }
  }
  return { photos, logo };
}

export async function nextPhotoSlot(
  listingId: string,
  limit: number = MAX_PHOTOS
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("listing_photos")
    .select("display_order")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "photo")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  if (error) return null;
  const used = new Set((data ?? []).map((r) => r.display_order));
  for (let i = 0; i < limit; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

export async function existingLogoId(listingId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("listing_photos")
    .select("id")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "logo")
    .is("deleted_at", null)
    .limit(1);
  return data?.[0]?.id ?? null;
}

export function buildStoragePath(listingId: string, kind: PhotoKind, uuid: string): string {
  return `${VERTICAL_KEY}/${listingId}/${kind}/${uuid}.webp`;
}

export function publicUrlFor(storagePath: string): string {
  const { data } = supabaseAdmin.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// After deleting a photo, compact display_order so the first remaining photo is hero.
export async function compactPhotoOrder(listingId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("listing_photos")
    .select("id, display_order")
    .eq("vertical", VERTICAL_KEY)
    .eq("listing_id", listingId)
    .eq("photo_kind", "photo")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });
  // TDL #1060 — K36. Two swallows lived here.
  //
  // (a) `if (!data) return;` treated a FAILED READ exactly like "this listing has no photos" —
  //     the fake-empty shape (#988). supabase-js RETURNS { data, error }; on error `data` is null.
  // (b) each resequencing UPDATE was awaited unchecked, so a failed compaction left the gallery
  //     mis-ordered (the wrong photo becomes hero) with no trace anywhere.
  //
  // DELIBERATELY FAIL-OPEN, but LOUD: by the time this runs the photo is already deleted and its
  // storage object removed. Throwing here would fail a delete that ALREADY SUCCEEDED and invite a
  // retry of a non-idempotent operation. A mis-ordered gallery is a UX defect; a delete that
  // reports failure after succeeding is a correctness one. So: log, and let the delete stand.
  if (error) {
    console.error(
      `[compactPhotoOrder] photo READ failed for listing ${listingId}: ${error.message} — order NOT compacted`
    );
    return;
  }
  if (!data) return;
  for (let i = 0; i < data.length; i++) {
    if (data[i].display_order !== i) {
      const { error: orderErr } = await supabaseAdmin
        .from("listing_photos")
        .update({ display_order: i })
        .eq("id", data[i].id);
      if (orderErr) {
        console.error(
          `[compactPhotoOrder] display_order=${i} write FAILED for photo ${data[i].id} ` +
            `(listing ${listingId}): ${orderErr.message} — gallery order may be wrong`
        );
      }
    }
  }
}
