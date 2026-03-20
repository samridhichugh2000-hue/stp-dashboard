import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (
    !req.auth &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/init-db")
  ) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
