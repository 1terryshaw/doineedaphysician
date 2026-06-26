import { NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import verticalConfig from "@/lib/vertical.config";
import { getVerticalIdentity } from "@/lib/cost-models";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let listingCount = 0;
  let costModelCount = 0;

  // Check Supabase connection
  try {
    const { count, error } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .select("*", { count: "exact", head: true });
    if (error) {
      checks.supabase = `error: ${error.message}`;
    } else {
      checks.supabase = "ok";
      listingCount = count ?? 0;
    }
  } catch (e) {
    checks.supabase = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // Cost Estimator lead magnet — verify seeded cost_models for this vertical.
  try {
    const { vertical_slug } = await getVerticalIdentity();
    const { count, error } = await supabaseAdmin
      .from("cost_models")
      .select("*", { count: "exact", head: true })
      .eq("vertical", vertical_slug);
    if (error) checks.cost_models = `error: ${error.message}`;
    else {
      costModelCount = count ?? 0;
      checks.cost_models = costModelCount > 0 ? "ok" : "EMPTY";
    }
  } catch (e) {
    checks.cost_models = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  // Check env vars
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_BASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "GMAIL_USER",
    "GMAIL_APP_PASSWORD",
  ];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
  checks.env_vars = missingVars.length === 0 ? "ok" : `missing: ${missingVars.join(", ")}`;

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    checks,
    vertical: verticalConfig.name,
    tablePrefix: verticalConfig.tablePrefix,
    listingCount,
    costModelCount,
    timestamp: new Date().toISOString(),
  });
}
