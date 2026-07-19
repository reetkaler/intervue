import { supabase } from "./supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function apiFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No active Supabase session");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    // FastAPI's standard error shape is {"detail": "..."} — show just that
    // message instead of the raw JSON blob when possible.
    let detail: string | null = null;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // Not JSON — fall through to the raw text below.
    }
    throw new Error(detail ?? text ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}
