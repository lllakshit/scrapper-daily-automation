const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

export class JsonRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
    readonly code: "INVALID_JSON" | "BODY_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE",
  ) {
    super(message);
    this.name = "JsonRequestError";
  }
}

export async function readJsonBody(
  request: Request,
  maximumBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new JsonRequestError("Content-Type must be application/json", 415, "UNSUPPORTED_MEDIA_TYPE");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes) {
      throw new JsonRequestError("The request body is too large", 413, "BODY_TOO_LARGE");
    }
  }

  if (!request.body) throw new JsonRequestError("The request body must be valid JSON", 400, "INVALID_JSON");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteCount += value.byteLength;
    if (byteCount > maximumBytes) {
      await reader.cancel();
      throw new JsonRequestError("The request body is too large", 413, "BODY_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new JsonRequestError("The request body must be valid JSON", 400, "INVALID_JSON");
  }
}
