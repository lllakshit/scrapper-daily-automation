import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import type { AuthConfig } from "./config";
import { getAuthConfig } from "./config";

const SESSION_ISSUER = "career-autopilot";
const SESSION_AUDIENCE = "career-autopilot-app";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export interface Session {
  readonly email: string;
}

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

function secretKey(config: AuthConfig): Uint8Array {
  return new TextEncoder().encode(config.sessionSecret);
}

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-career_autopilot_session"
    : "career_autopilot_session";
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high" as const,
  };
}

export async function issueSessionToken(
  config: AuthConfig = getAuthConfig(),
): Promise<string> {
  return new SignJWT({ email: config.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(config.email)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey(config));
}

export async function verifySessionToken(
  token: string | undefined,
  config: AuthConfig = getAuthConfig(),
): Promise<Session | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(config), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      subject: config.email,
      clockTolerance: 5,
    });
    if (payload.email !== config.email) return null;
    return Object.freeze({ email: config.email });
  } catch {
    return null;
  }
}

function cookieValueFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name === getSessionCookieName()) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function getSession(request?: Request): Promise<Session | null> {
  const token = request
    ? cookieValueFromRequest(request)
    : (await cookies()).get(getSessionCookieName())?.value;
  return verifySessionToken(token);
}

export async function requireSession(request?: Request): Promise<Session> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError();
  return session;
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
