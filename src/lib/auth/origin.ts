export class InvalidOriginError extends Error {
  readonly status = 403;

  constructor() {
    super("Request origin is not allowed");
    this.name = "InvalidOriginError";
  }
}

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new InvalidOriginError();
  }

  const requestOrigin = normalizedOrigin(request.url);
  const suppliedOrigin = normalizedOrigin(request.headers.get("origin") ?? "");
  const configuredOrigin = process.env.APP_ORIGIN
    ? normalizedOrigin(process.env.APP_ORIGIN)
    : null;
  const allowedOrigins = new Set(
    [requestOrigin, configuredOrigin].filter((origin): origin is string => Boolean(origin)),
  );

  if (!suppliedOrigin || !allowedOrigins.has(suppliedOrigin)) {
    throw new InvalidOriginError();
  }
}

export function isInvalidOriginError(error: unknown): error is InvalidOriginError {
  return error instanceof InvalidOriginError;
}
