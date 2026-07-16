import axios, { type AxiosError } from "axios";

type ApiErrorBody = { detail?: string | unknown[] } | string | null;

function asString(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim().length > 0) return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) {
      return String((first as { msg: unknown }).msg);
    }
    return JSON.stringify(detail);
  }
  return null;
}

export function extractApiError(
  err: unknown,
  fallback = "Error inesperado",
): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiErrorBody>;
    const body = ax.response?.data;
    if (typeof body === "string" && body.trim()) return body;
    if (body && typeof body === "object") {
      const fromDetail = asString(body.detail);
      if (fromDetail) return fromDetail;
    }
    if (ax.message) return ax.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
