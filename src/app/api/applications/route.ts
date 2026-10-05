import { applicationApi } from "@/lib/applications/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return applicationApi.list(request);
}

export async function POST(request: Request) {
  return applicationApi.create(request);
}
