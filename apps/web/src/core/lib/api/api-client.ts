import { BASE_URL } from "@/core/lib/basic-link/BackendBasicLink";

export type ApiErrorBody = {
  code: string;
  message?: string;
  orderId?: string;
};

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  data: T;
};

export type ApiFailure = {
  ok: false;
  status: number;
  error: ApiErrorBody;
  retryAfterSeconds: number | null;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export const NETWORK_ERROR_STATUS = 0;

type RequestOptions = {
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

function parseRetryAfter(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  const seconds = header === null ? Number.NaN : Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    return {
      code: typeof body.code === "string" ? body.code : "UNKNOWN_ERROR",
      message: typeof body.message === "string" ? body.message : undefined,
      orderId: typeof body.orderId === "string" ? body.orderId : undefined,
    };
  } catch {
    return { code: "UNKNOWN_ERROR" };
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      status: NETWORK_ERROR_STATUS,
      error: { code: "NETWORK_ERROR" },
      retryAfterSeconds: null,
    };
  }

  if (response.ok) {
    return { ok: true, status: response.status, data: (await response.json()) as T };
  }

  return {
    ok: false,
    status: response.status,
    error: await readErrorBody(response),
    retryAfterSeconds: parseRetryAfter(response),
  };
}
