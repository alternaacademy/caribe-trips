/** The single low-level entry point for talking to the API. Components and
 *  hooks go through the resource modules (`packages.ts`, `bookings.ts`) which
 *  call this — nothing else issues `fetch`. */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

/** Thrown on any non-2xx response, carrying the decoded error envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/** Perform a JSON request and decode the response (or throw `ApiError`). */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const envelope = (data as ErrorEnvelope | undefined)?.error;
    throw new ApiError(
      envelope?.code ?? 'unknown',
      envelope?.message ?? res.statusText,
      res.status,
    );
  }

  return data as T;
}

/** Build a `?a=b&c=d` string from defined, non-empty params. */
export function queryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[1] != null && entry[1] !== '',
  );
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}
