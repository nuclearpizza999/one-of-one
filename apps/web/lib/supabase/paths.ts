/** Routes that need no session: the sign-in screen and the development-only surfaces (absent in production anyway). */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/signin") return true;
  for (const prefix of ["/dev", "/api/dev"]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}
