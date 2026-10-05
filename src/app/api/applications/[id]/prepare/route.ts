import { applicationApi } from "@/lib/applications/api";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request, context: RouteContext<"/api/applications/[id]/prepare">) {
  const { id } = await context.params;
  return applicationApi.prepare(request, id);
}
