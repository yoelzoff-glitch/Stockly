import { meliFetch } from "../client";

export async function sendResponse(tenantId: string, questionId: number, answerText: string) {
  return await meliFetch({
    tenantId,
    endpoint: `/answers`,
    method: "POST",
    body: {
      question_id: questionId,
      text: answerText
    }
  });
}
