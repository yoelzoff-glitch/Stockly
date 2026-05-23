import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateResponse } from "../services/meli/questions/generateResponse";
import { sendResponse } from "../services/meli/questions/sendResponse";

export const questionsJob = inngest.createFunction(
  { 
    id: "process-meli-question",
    triggers: [{ event: "meli/questions.received" as any }]
  },
  async ({ event, step }) => {
    const { tenantId, resource } = event.data;

    // Fetch the question from Mercado Libre API
    const question = await step.run("fetch-question", async () => {
      const { meliFetch } = await import("../services/meli/client");
      return await meliFetch({
        tenantId,
        endpoint: resource,
        method: "GET"
      });
    });

    if (question.status !== "UNANSWERED") {
      return { message: "Question already answered", questionId: question.id };
    }

    // Generate answer via AI
    const answer = await step.run("generate-answer", async () => {
      // 1. Fetch product info to contextualize the AI
      const supabase = createAdminClient();
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("meli_item_id", question.item_id)
        .single();

      return generateResponse(question.text, product);
    });

    // Send answer if auto-respond is ON
    const result = await step.run("send-answer", async () => {
      const supabase = createAdminClient();
      const { data: prefs } = await supabase
        .from("tenant_preferences")
        .select("auto_respond_questions")
        .eq("tenant_id", tenantId)
        .single();

      if (prefs?.auto_respond_questions) {
        await sendResponse(tenantId, question.id, answer);
        return { action: "answered", text: answer };
      }
      return { action: "ignored", text: answer, reason: "auto_respond_disabled" };
    });

    return { message: "Processed question", details: result };
  }
);
