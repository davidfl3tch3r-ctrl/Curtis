import { NextResponse } from "next/server";
import { requireAdmin, serviceClient, forbidden } from "@/lib/admin-auth";

type DangerAction = "delete-test-leagues" | "clear-messages" | "reset-credits";

export async function POST(req: Request) {
  const auth = await requireAdmin({ adminOnly: true });
  if (!auth) return forbidden();

  const body = await req.json();
  const action: DangerAction = body.action;
  const sc = serviceClient();

  if (action === "delete-test-leagues") {
    // Fetch leagues whose names contain "test" (case-insensitive)
    const { data: testLeagues, error: fetchError } = await sc
      .from("leagues")
      .select("id")
      .ilike("name", "%test%");

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (testLeagues && testLeagues.length > 0) {
      const ids = testLeagues.map((l) => l.id);
      const { error: deleteError } = await sc
        .from("leagues")
        .delete()
        .in("id", ids);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({
        message: `Deleted ${ids.length} test league(s)`,
      });
    }

    return NextResponse.json({ message: "No test leagues found" });
  }

  if (action === "clear-messages") {
    try {
      const { error } = await sc.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ message: "All messages cleared" });
    } catch {
      return NextResponse.json({ message: "Messages table may not exist — skipped" });
    }
  }

  if (action === "reset-credits") {
    const { error } = await sc
      .from("teams")
      .update({ credits: 100 })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "All team credits reset to 100" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
