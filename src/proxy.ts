import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export const proxy = convexAuthNextjsMiddleware();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
