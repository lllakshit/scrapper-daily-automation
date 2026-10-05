export interface AuthConfig {
  readonly email: string;
  readonly password?: string;
  readonly passwordHash?: string;
  readonly sessionSecret: string;
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export function getAuthConfig(): AuthConfig {
  const email = process.env.APP_EMAIL?.trim().toLowerCase();
  const password = process.env.APP_PASSWORD;
  const passwordHash = process.env.APP_PASSWORD_HASH;
  const sessionSecret = process.env.APP_SESSION_SECRET ?? process.env.SESSION_SECRET;

  if (!email || !email.includes("@")) {
    throw new AuthConfigurationError("APP_EMAIL must be a valid email address");
  }
  if (!password && !passwordHash) {
    throw new AuthConfigurationError(
      "Set either APP_PASSWORD_HASH or APP_PASSWORD",
    );
  }
  if (!sessionSecret || new TextEncoder().encode(sessionSecret).length < 32) {
    throw new AuthConfigurationError(
      "APP_SESSION_SECRET or SESSION_SECRET must contain at least 32 bytes",
    );
  }

  return { email, password, passwordHash, sessionSecret };
}
