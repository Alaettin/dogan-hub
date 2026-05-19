import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let payload: { error?: ApiError } | undefined;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiRequestError(
      res.status,
      payload?.error ?? { code: "unknown", message: res.statusText },
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
