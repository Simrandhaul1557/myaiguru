import type { UserRole } from "@prisma/client";
import { auth } from "@/backend/auth";
import { prisma } from "@/backend/lib/db/prisma";
import { ApiError } from "@/backend/lib/api/errors";

export async function requireUser(allowedRoles?: UserRole[]) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, role: true, profileImage: true },
  });
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Your account is no longer available.");
  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== "ADMIN") {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to access this resource.");
  }
  return user;
}

export function assertOwnedBy(userId: string, ownerId: string) {
  if (userId !== ownerId) throw new ApiError(404, "NOT_FOUND", "The requested resource was not found.");
}
