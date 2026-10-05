import { NextResponse } from "next/server";
import { runConfiguredScan, ScanSetupError } from "@/lib/discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runConfiguredScan();
    return NextResponse.json({ success: true, data: { completedAt: result.completedAt, statistics: result.statistics }, error: null });
  } catch (error) {
    const message = error instanceof ScanSetupError ? error.message : "Scheduled scan failed";
    return NextResponse.json({ success: false, data: null, error: message }, { status: error instanceof ScanSetupError ? 409 : 500 });
  }
}
