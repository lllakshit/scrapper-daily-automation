import { z } from "zod";
import { assertSameOrigin, isInvalidOriginError, isUnauthorizedError, requireSession } from "@/lib/auth";
import { dismissOpportunity } from "@/lib/discovery";
import { JsonRequestError, readJsonBody } from "@/lib/http/read-json";

const InputSchema = z.object({ action: z.enum(["save", "prepare", "reject"]) }).strict();

export async function POST(request: Request, context: RouteContext<"/api/opportunities/[id]/decision">) {
  try {
    await requireSession(request);
    assertSameOrigin(request);
    InputSchema.parse(await readJsonBody(request));
    const { id } = await context.params;
    await dismissOpportunity(decodeURIComponent(id));
    return Response.json({ success: true, data: null, error: null });
  } catch (error) {
    if (isUnauthorizedError(error)) return Response.json({ success: false, data: null, error: error.message }, { status: 401 });
    if (isInvalidOriginError(error)) return Response.json({ success: false, data: null, error: error.message }, { status: error.status });
    if (error instanceof JsonRequestError) return Response.json({ success: false, data: null, error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ success: false, data: null, error: "Invalid decision" }, { status: 422 });
    return Response.json({ success: false, data: null, error: "The decision could not be saved" }, { status: 500 });
  }
}
