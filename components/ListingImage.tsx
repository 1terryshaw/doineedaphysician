"use client";

import { useEffect, useRef, useState } from "react";
import { listingPhotoUrl } from "@/lib/listing-photo-url";

// Logos need the same failure handling as gallery photos, without a leftover wrapper.
export default function ListingImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = listingPhotoUrl(src);
  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailedUrl(url);
  }, [url]);
  if (!url || failedUrl === url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={imageRef} src={url} alt={alt} className={className} onError={() => setFailedUrl(url)} />;
}
