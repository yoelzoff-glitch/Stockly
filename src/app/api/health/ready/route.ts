import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Lightweight in-memory rate limiter: max 60 requests per minute
const rateLimitWindowMs = 60000;
const maxRequestsPerWindow = 60;
let requestCount = 0;
let windowStartTime = Date.now();

export async function GET(request: Request) {
  const now = Date.now();
  if (now - windowStartTime > rateLimitWindowMs) {
    windowStartTime = now;
    requestCount = 0;
  }
  requestCount++;

  if (requestCount > maxRequestsPerWindow) {
    return NextResponse.json(
      { status: "too_many_requests" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Retry-After": "60",
        },
      }
    );
  }

  const configuredToken = process.env.HEALTHCHECK_TOKEN;

  // If token is not configured in production, do not expose readiness
  if (!configuredToken) {
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
      }
    );
  }

  // Check auth header strictly via Bearer or x-healthcheck-token
  const authHeader = request.headers.get("authorization") || "";
  const tokenHeader = request.headers.get("x-healthcheck-token");

  const providedToken =
    tokenHeader ||
    (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);

  if (!providedToken || providedToken !== configuredToken) {
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
      }
    );
  }

  // Lightweight DB ping with 3s timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("plans_config")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (error) {
      return NextResponse.json(
        { status: "not_ready" },
        {
          status: 503,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
        }
      );
    }

    return NextResponse.json(
      { status: "ready" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
      }
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
      }
    );
  }
}

