import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  return NextResponse.json(
    {
      success: true,
      data: { authenticated: Boolean(session), email: session?.email ?? null },
      error: null,
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
