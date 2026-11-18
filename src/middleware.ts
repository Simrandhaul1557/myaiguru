import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/backend/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const roleFromPath = request.nextUrl.pathname.startsWith("/trainer/") ? "TRAINER" : "STUDENT";
  const user = request.auth?.user;
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (user.role !== roleFromPath && user.role !== "ADMIN") {
    const destination = user.role === "TRAINER" ? "/trainer/dashboard" : "/student/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/student/:path*", "/trainer/:path*"],
};
