import { PublicFetchResult } from "./types";

const MELI_PUBLIC_API_BASE = "https://api.mercadolibre.com";
const DEFAULT_TIMEOUT_MS = 8000;

export interface MeliPublicFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Public Mercado Libre API client for competitor benchmarking.
 * Strictly uses GET without OAuth tokens, credentials, or tenant state.
 * Never throws unhandled exceptions on expected HTTP failures (401, 403, 404, 429, 5xx).
 */
export async function meliPublicFetch<T = any>(
  endpoint: string,
  options: MeliPublicFetchOptions = {}
): Promise<PublicFetchResult<T>> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${MELI_PUBLIC_API_BASE}${cleanEndpoint}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "LibretaX-Benchmarking/1.0",
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      try {
        const data = (await response.json()) as T;
        return {
          ok: true,
          status: response.status,
          data,
        };
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: response.status,
          error: `JSON parsing error: ${jsonErr.message}`,
        };
      }
    }

    let errorDetails = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody?.message) {
        errorDetails = errBody.message;
      }
    } catch {
      // Body may not be JSON, keep default errorDetails
    }

    return {
      ok: false,
      status: response.status,
      error: errorDetails,
    };
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ok: false,
      status: isTimeout ? 408 : 500,
      error: isTimeout ? "Request timed out" : (err?.message || "Network request failed"),
    };
  }
}
