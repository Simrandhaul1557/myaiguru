import { NextResponse } from "next/server";
import { requireUser } from "@/backend/lib/auth/access";
import { errorResponse } from "@/backend/lib/api/errors";

export async function GET() {
  try {
    return NextResponse.json({ user: await requireUser() });
  } catch (error) {
    return errorResponse(error);
  }
}
