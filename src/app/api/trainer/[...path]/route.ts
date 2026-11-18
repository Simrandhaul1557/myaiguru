import { handleTrainerApi } from "@/backend/lib/services/trainer-api";

export const runtime = "nodejs";
export const GET = handleTrainerApi;
export const POST = handleTrainerApi;
export const PATCH = handleTrainerApi;
export const DELETE = handleTrainerApi;
