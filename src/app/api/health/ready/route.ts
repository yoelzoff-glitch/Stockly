import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredToken = process.env.HEALTHCHECK_TOKEN;

  // If token is not configured in production, do not expose readiness
  if (!configuredToken) {
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
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
        headers: { "Cache-Control": "no-store" },
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
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      { status: "ready" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
