import { profileApi } from "@/lib/profile/api";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return profileApi.getProfile(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return profileApi.patchProfile(request);
}
