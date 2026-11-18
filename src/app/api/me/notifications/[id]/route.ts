import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { ApiError, errorResponse } from "@/backend/lib/api/errors";
import { prisma } from "@/backend/lib/db/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const updated = await prisma.notification.updateMany({ where: { id, userId: user.id }, data: { isRead: true } });
    if (!updated.count) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
