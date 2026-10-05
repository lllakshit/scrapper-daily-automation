import { applicationApi } from "@/lib/applications/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/applications/[id]">) {
  const { id } = await context.params;
  return applicationApi.get(request, id);
}

export async function PATCH(request: Request, context: RouteContext<"/api/applications/[id]">) {
  const { id } = await context.params;
  return applicationApi.update(request, id);
}
