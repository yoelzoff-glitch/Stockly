import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWorkflow } from "@/services/ai/workflows";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get user profile and tenantId
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant assigned" }, { status: 403 });
    }

    // 3. Parse action details
    const { workflowId, action } = await req.json();
    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
    }

    if (action === "approve") {
      // Execute the workflow actions sequentially
      const result = await executeWorkflow(tenantId, workflowId);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, result });
    } else if (action === "reject") {
      // Update workflow status to 'rejected'
      const { error: rejectError } = await adminSupabase
        .from("action_workflows")
        .update({ status: "rejected" })
        .eq("id", workflowId)
        .eq("tenant_id", tenantId);

      if (rejectError) {
        throw rejectError;
      }
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "WORKFLOWS_EXECUTE" } });
    console.error("Exception in workflows/execute API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
