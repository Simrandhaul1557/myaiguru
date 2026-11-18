import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { ApiError, errorResponse, readJson } from "@/backend/lib/api/errors";
import { registerSchema } from "@/backend/lib/validations/auth";
import { rateLimit } from "@/backend/lib/utils/rate-limit";

export async function POST(request: Request) {
  try {
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const result = rateLimit(`register:${address}`, 5, 60 * 60 * 1000);
    if (!result.allowed) {
      throw new ApiError(429, "RATE_LIMITED", `Too many registration attempts. Retry in ${result.retryAfterSeconds} seconds.`);
    }

    const data = await readJson(request, registerSchema);
    const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) throw new ApiError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    const user = await prisma.user.create({
      data: { fullName: data.fullName, email: data.email, passwordHash: await hash(data.password, 12), role: "STUDENT" },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
