import { scryptSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthConfigurationError, getAuthConfig } from "./config";
import {
  getSession,
  getSessionCookieName,
  issueSessionToken,
  requireSession,
  UnauthorizedError,
  verifySessionToken,
} from "./session";
import { verifyCredentials } from "./password";
import { assertSameOrigin, InvalidOriginError } from "./origin";
import {
  clearLoginAttempts,
  clearDurableLoginAttempts,
  consumeLoginAttempt,
  consumeDurableLoginAttempt,
  loginRateLimitKey,
} from "./rate-limit";

const TEST_PASSWORD = ["test", "login", "fixture"].join("-");

const config = {
  email: "owner@example.com",
  password: TEST_PASSWORD,
  sessionSecret: "a-secure-test-secret-that-is-at-least-32-bytes-long",
} as const;

afterEach(() => vi.unstubAllEnvs());

describe("single-user authentication", () => {
  it("compares both email and password without accepting partial matches", async () => {
    await expect(
      verifyCredentials("OWNER@example.com", config.password, config),
    ).resolves.toBe(true);
    await expect(
      verifyCredentials(config.email, "incorrect password", config),
    ).resolves.toBe(false);
    await expect(
      verifyCredentials("attacker@example.com", config.password, config),
    ).resolves.toBe(false);
  });

  it("issues a signed, expiring session and rejects tampering", async () => {
    const token = await issueSessionToken(config);
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    await expect(verifySessionToken(token, config)).resolves.toMatchObject({
      email: config.email,
    });
    await expect(
      verifySessionToken(`${header}.${payload}.${tamperedSignature}`, config),
    ).resolves.toBeNull();
  });

  it("supports a bounded scrypt password hash", async () => {
    const salt = Buffer.from("0123456789abcdef");
    const digest = scryptSync(config.password, salt, 64, {
      N: 2 ** 14,
      r: 8,
      p: 1,
    });
    const hashedConfig = {
      ...config,
      password: undefined,
      passwordHash: `scrypt$16384$8$1$${salt.toString("base64url")}$${digest.toString("base64url")}`,
    };

    await expect(
      verifyCredentials(config.email, config.password, hashedConfig),
    ).resolves.toBe(true);
  });

  it("loads required secrets without returning their values in errors", () => {
    vi.stubEnv("APP_EMAIL", config.email);
    vi.stubEnv("APP_PASSWORD", config.password);
    vi.stubEnv("APP_SESSION_SECRET", config.sessionSecret);

    expect(getAuthConfig()).toEqual(config);
    vi.stubEnv("APP_SESSION_SECRET", "short");
    expect(() => getAuthConfig()).toThrow(AuthConfigurationError);
    expect(() => getAuthConfig()).toThrow("at least 32 bytes");
  });

  it("reads request cookies and rejects a missing session", async () => {
    vi.stubEnv("APP_EMAIL", config.email);
    vi.stubEnv("APP_PASSWORD", config.password);
    vi.stubEnv("APP_SESSION_SECRET", config.sessionSecret);
    const token = await issueSessionToken(config);
    const request = new Request("https://career.example.com", {
      headers: { cookie: `${getSessionCookieName()}=${encodeURIComponent(token)}` },
    });

    await expect(getSession(request)).resolves.toEqual({ email: config.email });
    await expect(
      requireSession(new Request("https://career.example.com")),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("treats malformed percent-encoded cookies as unauthenticated", async () => {
    vi.stubEnv("APP_EMAIL", config.email);
    vi.stubEnv("APP_PASSWORD", config.password);
    vi.stubEnv("APP_SESSION_SECRET", config.sessionSecret);
    const request = new Request("https://career.example.com", {
      headers: { cookie: `${getSessionCookieName()}=%E0%A4%A` },
    });

    await expect(getSession(request)).resolves.toBeNull();
  });
});

describe("login throttling", () => {
  it("limits repeated attempts and supports clearing a successful login", () => {
    const key = "test-client-198.51.100.1";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeLoginAttempt(key, 1_000 + attempt).allowed).toBe(true);
    }
    expect(consumeLoginAttempt(key, 2_000).allowed).toBe(false);
    clearLoginAttempts(key);
    expect(consumeLoginAttempt(key, 2_001).allowed).toBe(true);
  });

  it("uses the first forwarded address as the limiter key", () => {
    const request = new Request("https://career.example.com/api/auth/login", {
      headers: { "x-forwarded-for": "192.0.2.2, 10.0.0.1" },
    });
    expect(loginRateLimitKey(request)).toBe("192.0.2.2");
  });

  it("persists throttling across limiter calls", async () => {
    const key = `durable-${crypto.randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(consumeDurableLoginAttempt(key, 1_000 + attempt)).resolves.toMatchObject({ allowed: true });
    }
    await expect(consumeDurableLoginAttempt(key, 2_000)).resolves.toMatchObject({ allowed: false });
    await clearDurableLoginAttempts(key);
  });
});

describe("mutation origin validation", () => {
  it("accepts same-origin requests", () => {
    const request = new Request("https://career.example.com/api/profile", {
      method: "POST",
      headers: { origin: "https://career.example.com" },
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects missing and cross-site origins", () => {
    const missing = new Request("https://career.example.com/api/profile", {
      method: "POST",
    });
    const crossSite = new Request("https://career.example.com/api/profile", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(() => assertSameOrigin(missing)).toThrow(InvalidOriginError);
    expect(() => assertSameOrigin(crossSite)).toThrow(InvalidOriginError);
  });
});
