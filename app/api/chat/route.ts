import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "This directory uses the triage quiz instead of AI chat. Visit the homepage to take the check-in." },
    { status: 200 }
  );
}
