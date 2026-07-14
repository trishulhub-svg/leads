// src/middleware.ts
// Auth gate. Public routes: /login, /forgot-password, /reset-password, open-tracking pixel.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/forgot-password", "/reset-password"];
const COOKIE = "tl_session";

async function isAuthenticated(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return false;
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

function sanitizeRedirect(path: string): string {
  if (/^\/(?!\/)/.test(path) && !path.startsWith("//")) return path;
  return "/";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The open-tracking pixel must be publicly accessible.
  if (pathname.startsWith("/api/track/open/")) {
    return NextResponse.next();
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // If already logged in and visiting /login, send to dashboard.
    if (pathname === "/login" && (await isAuthenticated(req.cookies.get(COOKIE)?.value))) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!(await isAuthenticated(req.cookies.get(COOKIE)?.value))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", sanitizeRedirect(pathname));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets and the open-track pixel is allowed above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/track).*)"],
};
