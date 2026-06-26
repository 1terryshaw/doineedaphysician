import verticalConfig from "@/lib/vertical.config";
import { can, getEffectiveTier } from "@/lib/tier-capabilities";

interface TierBadgeProps {
  tier?: string;
  subscription_tier?: string;
  is_claimed?: boolean;
}

const BASE = "text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap";

export default function TierBadge({
  tier,
  subscription_tier,
  is_claimed,
}: TierBadgeProps) {
  // TDL #471: the premium/Featured badge renders ONLY when the listing's LIVE
  // subscription grants the "featured" entitlement (Reviews Plus or higher) — keyed off
  // the same capability system the #472 guard uses, NOT a stored publish/featured flag.
  const effectiveTier = getEffectiveTier({ tier, subscription_tier });

  if (can(effectiveTier, "featured")) {
    if (effectiveTier === "growth") {
      return <span className={`${BASE} bg-purple-600 text-white`}>Growth</span>;
    }
    if (effectiveTier === "website") {
      return <span className={`${BASE} bg-amber-500 text-white`}>Website</span>;
    }
    return (
      <span
        className={`${BASE} text-white`}
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        Featured
      </span>
    );
  }

  if (is_claimed) {
    return (
      <span className={`${BASE} bg-green-100 text-green-800`}>✓ Verified</span>
    );
  }

  return null;
}
