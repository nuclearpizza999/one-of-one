import { NextResponse } from "next/server";
import { devBypassEnabled, devSignIn } from "@/lib/supabase/dev-bypass";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Development only: the codeword on /signin. Signs into the local dev account and sets the session cookies. */
export async function POST(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production" || !devBypassEnabled()) return new NextResponse(null, { status: 404 });
  const ok = await devSignIn(await createServerSupabase());
  if (!ok) return NextResponse.json({ error: "dev sign-in failed; run npm run supabase:env" }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
