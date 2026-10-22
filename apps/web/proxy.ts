import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { isPublicPath } from "@/lib/supabase/paths";

/** Refreshes the session cookie and walls every route but the public ones behind sign-in. */
export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) return response;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "sign in first" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const signin = request.nextUrl.clone();
  signin.pathname = "/signin";
  signin.search = "";
  return NextResponse.redirect(signin);
}

export const config = {
  // Everything but Next's own files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
