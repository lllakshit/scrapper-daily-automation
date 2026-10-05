import { NextResponse } from "next/server";

import { assertSameOrigin, InvalidOriginError } from "@/lib/auth/origin";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  requireSession,
  UnauthorizedError,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireSession(request);
    const response = NextResponse.json(
      { success: true, data: null, error: null },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(getSessionCookieName(), "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const status =
      error instanceof InvalidOriginError || error instanceof UnauthorizedError
        ? error.status
        : 500;
    const message = status === 500 ? "Sign-out failed" : error instanceof Error ? error.message : "Sign-out failed";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
