// TDL #1391 — client-safe Leads Plus (health) constants. NO server imports here: components/HealthLeadForm.tsx is a client
// component, and importing lib/health-leads-plus.ts (→ lib/supabase.ts, service-role client) into the browser bundle throws
// "supabaseKey is required" on hydration of every listing page (fix-up 1, 2026-10-31).
export const PREFERRED_TIMES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
] as const;
export type PreferredTime = (typeof PREFERRED_TIMES)[number]["value"];

export const MESSAGE_MAX = 300;

export const CRISIS_LINE = {
  US: "If you are in crisis or thinking about suicide, call or text 988 (Suicide & Crisis Lifeline). In an emergency, call 911.",
  CA: "If you are in crisis or thinking about suicide, call or text 9-8-8 (Suicide Crisis Helpline). In an emergency, call 911.",
} as const;
