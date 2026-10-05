import { interviewApi } from "@/lib/interviews/api";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/interviews/[id]">) {
  const { id } = await context.params;
  return interviewApi.get(request, id);
}

export async function PATCH(request: Request, context: RouteContext<"/api/interviews/[id]">) {
  const { id } = await context.params;
  return interviewApi.update(request, id);
}
