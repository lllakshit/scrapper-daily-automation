import { interviewApi } from "@/lib/interviews/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return interviewApi.list(request);
}

export async function POST(request: Request) {
  return interviewApi.create(request);
}
