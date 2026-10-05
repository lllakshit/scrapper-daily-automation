import type { EmploymentType, RemoteType } from "../jobs/schema";
import { normalizeText, stripHtml } from "../jobs/text";

export function cleanDescription(html: string): string {
  return stripHtml(html).replace(/\s+/g, " ").trim();
}

export function inferRemoteType(remote: boolean, location: string): RemoteType {
  if (remote || /\bremote\b/i.test(location)) return "remote";
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  return location ? "onsite" : "unknown";
}

export function normalizeEmploymentType(value: string | undefined): EmploymentType {
  const normalized = normalizeText(value ?? "");
  if (normalized.includes("full time") || normalized === "fulltime") return "full-time";
  if (normalized.includes("part time") || normalized === "parttime") return "part-time";
  if (normalized.includes("contract") || normalized.includes("freelance")) return "contract";
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("temporary")) return "temporary";
  return "unknown";
}

export async function requireJson(response: Response, source: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) throw new Error(`${source} returned a non-JSON response`);
  return response.json();
}

