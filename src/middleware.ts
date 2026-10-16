import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs on the server before any /admin page. getUser() asks Supabase to verify the token, so a forged cookie fails.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const onLogin = req.nextUrl.pathname.startsWith("/admin/login");
  let user = null;
  if (url && key) {
    const sb = createServerClient(url, key, { cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => { list.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } });
    user = (await sb.auth.getUser()).data.user;
  }
  if (!user && !onLogin) return NextResponse.redirect(new URL("/admin/login", req.url)); // fails closed
  if (user && onLogin) return NextResponse.redirect(new URL("/admin", req.url));
  return res;
}
export const config = { matcher: ["/admin/:path*"] };
