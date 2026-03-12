import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type AdminRole = "admin" | "moderator";

/** Supabase client with service role key — bypasses RLS */
export function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify the current request is from an admin or moderator.
 * Pass `{ adminOnly: true }` to require the 'admin' role specifically.
 *
 * Returns `{ userId, role }` on success.
 * Returns `null` if the user is not authenticated or not authorized.
 */
export async function requireAdmin(
  options?: { adminOnly?: boolean }
): Promise<{ userId: string; role: AdminRole } | null> {
  const cookieStore = await cookies();

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // read-only in route handlers
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) return null;

  const sc = serviceClient();
  const { data: profile, error: profileError } = await sc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  const role = profile.role as string;

  if (role !== "admin" && role !== "moderator") return null;
  if (options?.adminOnly && role !== "admin") return null;

  return { userId: user.id, role: role as AdminRole };
}

/** Convenience: return a 403 JSON response */
export function forbidden(msg?: string): NextResponse {
  return NextResponse.json({ error: msg ?? "Forbidden" }, { status: 403 });
}
