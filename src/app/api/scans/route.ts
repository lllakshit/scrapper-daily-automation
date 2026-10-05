import { NextResponse } from "next/server";
import { assertSameOrigin, isInvalidOriginError, isUnauthorizedError, requireSession } from "@/lib/auth";
import { runConfiguredScan, ScanSetupError } from "@/lib/discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireSession(request);
    assertSameOrigin(request);
    const result = await runConfiguredScan();
    return NextResponse.json({ success: true, data: result, error: null });
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ success: false, data: null, error: error.message }, { status: 401 });
    if (isInvalidOriginError(error)) return NextResponse.json({ success: false, data: null, error: error.message }, { status: error.status });
    if (error instanceof ScanSetupError) return NextResponse.json({ success: false, data: null, error: error.message }, { status: 409 });
    console.error("Job scan failed", error);
    return NextResponse.json({ success: false, data: null, error: "The scan could not finish. Your previous results are still safe." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { readLatestScan } = await import("@/lib/discovery");
    return NextResponse.json({ success: true, data: await readLatestScan(), error: null });
  } catch (error) {
    if (isUnauthorizedError(error)) return NextResponse.json({ success: false, data: null, error: error.message }, { status: 401 });
    return NextResponse.json({ success: false, data: null, error: "Scan status is unavailable" }, { status: 500 });
  }
}
