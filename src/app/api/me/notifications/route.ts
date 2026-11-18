import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { errorResponse } from "@/backend/lib/api/errors";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    return errorResponse(error);
  }
}
