import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthConfigurationError, getAuthConfig } from "@/lib/auth/config";
import { assertSameOrigin, InvalidOriginError } from "@/lib/auth/origin";
import { verifyCredentials } from "@/lib/auth/password";
import {
  clearDurableLoginAttempts,
  consumeDurableLoginAttempt,
  loginRateLimitKey,
} from "@/lib/auth/rate-limit";
import { JsonRequestError, readJsonBody } from "@/lib/http/read-json";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  issueSessionToken,
} from "@/lib/auth/session";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1_024),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, data: null, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = credentialsSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return errorResponse("Invalid email or password", 401);
    const config = getAuthConfig();
    const key = `${config.email}|${loginRateLimitKey(request)}`;
    const limit = await consumeDurableLoginAttempt(key);
    if (!limit.allowed) {
      const response = errorResponse("Too many sign-in attempts. Try again later.", 429);
      response.headers.set("Retry-After", String(limit.retryAfterSeconds));
      return response;
    }

    const valid = await verifyCredentials(parsed.data.email, parsed.data.password, config);
    if (!valid) return errorResponse("Invalid email or password", 401);

    await clearDurableLoginAttempts(key);
    const response = NextResponse.json(
      { success: true, data: { email: config.email }, error: null },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      getSessionCookieName(),
      await issueSessionToken(config),
      getSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof InvalidOriginError) return errorResponse(error.message, error.status);
    if (error instanceof JsonRequestError) return errorResponse(error.message, error.status);
    if (error instanceof SyntaxError) return errorResponse("Invalid JSON request", 400);
    if (error instanceof AuthConfigurationError) {
      console.error("Authentication configuration is incomplete:", error.message);
    } else {
      console.error("Sign-in failed unexpectedly", error);
    }
    return errorResponse("Sign-in is temporarily unavailable", 500);
  }
}
