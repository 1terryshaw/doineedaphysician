"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
const DISMISS_KEY = "addbiz_banner_dismissed";
export default function AddBusinessBanner() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true); } catch {} }, []);
  if (dismissed) return null;
  function dismiss() { try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} setDismissed(true); }
  return (
    <div className="-mx-4 mb-6 bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-800">Don&rsquo;t see your physician?{" "}
          <Link href="/list-your-business" className="font-semibold underline" style={{ color: verticalConfig.primaryColor }}>Add it &rarr;</Link></p>
        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1">&times;</button>
      </div>
    </div>
  );
}
