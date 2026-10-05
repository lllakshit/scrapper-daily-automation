import { profileApi } from "@/lib/profile/api";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return profileApi.getPreferences(request);
}

export async function PUT(request: Request): Promise<Response> {
  return profileApi.putPreferences(request);
}
