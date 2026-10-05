import { scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

import type { AuthConfig } from "./config";

const DUMMY_PASSWORD = "invalid-credential-padding-value";

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = Buffer.from(left);
  const rightDigest = Buffer.from(right);
  const paddedLength = Math.max(leftDigest.length, rightDigest.length, 1);
  const paddedLeft = Buffer.alloc(paddedLength);
  const paddedRight = Buffer.alloc(paddedLength);
  leftDigest.copy(paddedLeft);
  rightDigest.copy(paddedRight);

  return timingSafeEqual(paddedLeft, paddedRight) && leftDigest.length === rightDigest.length;
}

async function verifyScryptHash(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, nValue, rValue, pValue, saltValue, digestValue, ...extra] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    extra.length > 0 ||
    !nValue ||
    !rValue ||
    !pValue ||
    !saltValue ||
    !digestValue
  ) {
    return false;
  }

  const cost = Number(nValue);
  const blockSize = Number(rValue);
  const parallelization = Number(pValue);
  if (
    !Number.isInteger(cost) ||
    cost < 2 ** 14 ||
    cost > 2 ** 20 ||
    (cost & (cost - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 32 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > 16
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(digestValue, "base64url");
    const salt = Buffer.from(saltValue, "base64url");
    if (expected.length < 32 || expected.length > 128 || salt.length < 16) return false;
    const maxmem = Math.max(32 * 1024 * 1024, 256 * cost * blockSize);
    const actual = await scrypt(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function verifyCredentials(
  email: string,
  password: string,
  config: AuthConfig,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const emailMatches = constantTimeEqual(normalizedEmail, config.email);
  const suppliedPassword = password || DUMMY_PASSWORD;
  const passwordMatches = config.passwordHash
    ? await verifyScryptHash(suppliedPassword, config.passwordHash)
    : constantTimeEqual(suppliedPassword, config.password ?? DUMMY_PASSWORD);

  return emailMatches && passwordMatches && password.length > 0;
}
