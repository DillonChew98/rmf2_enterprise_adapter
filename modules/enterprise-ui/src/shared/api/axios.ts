import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:7900",
  headers: { "Content-Type": "application/json" },
});

// Default to the in-browser mock adapter unless explicitly disabled. The
// real rmf2_enterprise_adapter REST API can be wired in by setting
// VITE_USE_MOCK=false; the entity api modules branch on this flag.
export const USE_MOCK =
  (import.meta.env.VITE_USE_MOCK ?? "true").toLowerCase() !== "false";

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
