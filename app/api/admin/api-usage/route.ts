import { NextResponse } from "next/server";
import { requireAdmin, forbidden } from "@/lib/admin-auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return forbidden();

  try {
    const res = await fetch("https://v3.football.api-sports.io/status", {
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY ?? "",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: 500 }
      );
    }

    const json = await res.json();
    const account = json?.response?.requests;

    return NextResponse.json({
      used: account?.current ?? null,
      remaining: account?.limit_day != null && account?.current != null
        ? account.limit_day - account.current
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
