import { handleAdminApi } from "@/backend/lib/services/admin-api";

export const runtime = "nodejs";
export const GET = handleAdminApi;
export const POST = handleAdminApi;
export const PATCH = handleAdminApi;
export const DELETE = handleAdminApi;
