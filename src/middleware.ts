// src/middleware.ts
// Auth gate for PAGES only. All /api/* routes are excluded — each API route
// handler does its own auth (getCurrentUser() for cookie-auth routes,
// CRON_SECRET for cron endpoints). This prevents the middleware from 307-
// redirecting fetch() calls and Vercel Cron (which sends headers, not cookies).
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const PUBLIC_PAGES = ["/login", "/forgot-password", "/reset-password"];
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

  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
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

// Exclude ALL /api/* routes (each route handler does its own auth).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};