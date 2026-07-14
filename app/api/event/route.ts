// TDL #1019 — Wave 3: shared /api/event collector.
//
// The ONE endpoint all client-side surfaces POST to (quiz answers, listing clicks).
// Server-side surfaces (chat, calculator) call logEvent() directly instead — no HTTP hop,
// so no added latency on the user's response path.
//
// `vertical` / `market` / `property` are NEVER read from the request body — they are derived
// server-side from verticalConfig inside logEvent(). A malicious or lazy client cannot set them.

import { NextRequest, NextResponse } from "next/server";
import { logEvent, type Surface, type EventType } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SURFACES: Surface[] = ["chat", "quiz", "calculator", "directory"];
const EVENT_TYPES: EventType[] = [
  "started", "question_asked", "answered", "completed",
  "listing_clicked", "listing_selected", "abandoned", "error",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const surface = body?.surface as Surface;
    const event_type = body?.event_type as EventType;
    const session_id = typeof body?.session_id === "string" ? body.session_id : null;

    // Validate the enums here so a bad client gets a 400 rather than poisoning the table
    // (or blowing up on the DB's enum constraint).
    if (!session_id || !SURFACES.includes(surface) || !EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({ ok: false, error: "invalid event" }, { status: 400 });
    }

    await logEvent(
      {
        session_id,
        surface,
        event_type,
        city: body?.city ?? null,
        region: body?.region ?? null,
        inferred_vertical: body?.inferred_vertical ?? null,
        intent: body?.intent ?? null,
        urgency: body?.urgency ?? null,
        outbound_url: body?.outbound_url ?? null,
        listing_slug: body?.listing_slug ?? null,
        turn_index: typeof body?.turn_index === "number" ? body.turn_index : null,
        payload: typeof body?.payload === "object" && body.payload ? body.payload : {},
      },
      req
    );

    return NextResponse.json({ ok: true });
  } catch {
    // FAIL-OPEN: analytics must never be a source of user-visible errors.
    return NextResponse.json({ ok: true });
  }
}
