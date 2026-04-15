/**
 * Role-based route protection middleware
 * Requirements: 8.1, 8.5
 *
 * - All /(dashboard) routes require authentication
 * - Driver role is blocked from controller-only routes (403)
 * - Unauthenticated users are redirected to /login
 */

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Routes that Drivers are not allowed to access
const CONTROLLER_ONLY_ROUTES = [
  "/signals",
  "/incidents",
  "/predictions",
  "/analytics",
];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    if (
      role === "Driver" &&
      CONTROLLER_ONLY_ROUTES.some((route) => pathname.startsWith(route))
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: insufficient role" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Return true only when a valid JWT token exists
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  // Protect all dashboard routes; leave auth and API routes open
  matcher: [
    "/monitoring/:path*",
    "/signals/:path*",
    "/incidents/:path*",
    "/predictions/:path*",
    "/analytics/:path*",
    "/routes/:path*",
  ],
};
