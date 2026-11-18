import { handleStudentApi } from "@/backend/lib/services/student-api";

export const runtime = "nodejs";
export const GET = handleStudentApi;
export const POST = handleStudentApi;
export const PATCH = handleStudentApi;
export const DELETE = handleStudentApi;
