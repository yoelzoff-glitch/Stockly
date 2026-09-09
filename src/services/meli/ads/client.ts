import { meliFetch } from "../client";
import { logger } from "@/lib/errors/logger";

export interface MeliAdsFetchArgs {
  tenantId?: string;
  meliAccountId?: string;
  endpoint: string;
  apiVersion?: "1" | "2";
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function meliAdsFetch({
  tenantId,
  meliAccountId,
  endpoint,
  apiVersion = "2",
  method = "GET",
  body,
  headers = {},
  timeoutMs,
}: MeliAdsFetchArgs): Promise<any> {
  const startTime = Date.now();

  try {
    const res = await meliFetch({
      tenantId,
      meliAccountId,
      endpoint,
      method,
      body,
      headers: {
        "api-version": apiVersion,
        ...headers,
      },
      timeoutMs,
    });

    const durationMs = Date.now() - startTime;
    logger.info({
      event: "MELI_ADS_FETCH_SUCCESS",
      tenantId,
      endpoint,
      apiVersion,
      durationMs,
    });

    return res;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    logger.error({
      event: "MELI_ADS_FETCH_FAILED",
      tenantId,
      endpoint,
      apiVersion,
      durationMs,
      statusCode: error?.statusCode || error?.status,
      errorMessage: error?.message,
    });
    throw error;
  }
}
