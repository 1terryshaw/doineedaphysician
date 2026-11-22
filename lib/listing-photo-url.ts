// Shared by the server page and client images: unresolved photo references are not URLs.
export function listingPhotoUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url || /[\\\x00-\x1f\x7f]/.test(url)) return null;
  if (/^\/(?!\/)/.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname ? url : null;
  } catch {
    return null;
  }
}
