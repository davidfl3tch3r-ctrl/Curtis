import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  const sc = serviceClient();
  const { data: profile } = await sc
    .from("profiles")
    .select("username")
    .eq("id", auth.userId)
    .single();

  return NextResponse.json({
    role: auth.role,
    username: profile?.username ?? null,
  });
}
