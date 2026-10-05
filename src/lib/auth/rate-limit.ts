import { createHash, randomUUID } from "node:crypto";

import { getJsonStore } from "@/lib/storage";

interface AttemptWindow {
  readonly attempts: readonly number[];
  readonly decision?: {
    readonly id: string;
    readonly allowed: boolean;
    readonly retryAfterSeconds: number;
  };
}

const WINDOW_MS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 5;
const attemptsByKey = new Map<string, AttemptWindow>();

function recentAttempts(key: string, now: number): readonly number[] {
  return (attemptsByKey.get(key)?.attempts ?? []).filter(
    (attempt) => now - attempt < WINDOW_MS,
  );
}

export function consumeLoginAttempt(key: string, now = Date.now()) {
  const attempts = recentAttempts(key, now);
  if (attempts.length >= MAX_ATTEMPTS) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - attempts[0])) / 1_000)),
    };
  }
  attemptsByKey.set(key, { attempts: [...attempts, now] });
  return { allowed: true as const, retryAfterSeconds: 0 };
}

export function clearLoginAttempts(key: string): void {
  attemptsByKey.delete(key);
}

export function loginRateLimitKey(request: Request): string {
  const header = process.env.VERCEL === "1" ? "x-vercel-forwarded-for" : "x-forwarded-for";
  const trustedAddress = request.headers.get(header)?.split(",")[0]?.trim().slice(0, 64);
  return trustedAddress || "unknown";
}

function durableKey(key: string): string {
  return `auth/login-attempts/${createHash("sha256").update(key).digest("hex")}`;
}

export async function consumeDurableLoginAttempt(key: string, now = Date.now()) {
  const decisionId = randomUUID();
  const record = await getJsonStore().update<AttemptWindow>(
    durableKey(key),
    { schemaVersion: 1, initialValue: { attempts: [] } },
    (current) => {
      const attempts = current.attempts.filter((attempt) => now - attempt < WINDOW_MS);
      const allowed = attempts.length < MAX_ATTEMPTS;
      const retryAfterSeconds = allowed
        ? 0
        : Math.max(1, Math.ceil((WINDOW_MS - (now - attempts[0]!)) / 1_000));
      return {
        attempts: allowed ? [...attempts, now] : [...attempts],
        decision: { id: decisionId, allowed, retryAfterSeconds },
      };
    },
  );
  const decision = record.value.decision;
  if (!decision || decision.id !== decisionId) throw new Error("Login limiter state is inconsistent");
  return { allowed: decision.allowed, retryAfterSeconds: decision.retryAfterSeconds };
}

export async function clearDurableLoginAttempts(key: string): Promise<void> {
  await getJsonStore().delete(durableKey(key));
}
