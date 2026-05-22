import { refreshMeliToken } from "../refreshToken";

export async function sendResponse(tenantId: string, questionId: number, answerText: string) {
  const accessToken = await refreshMeliToken(tenantId);

  const response = await fetch(`https://api.mercadolibre.com/answers`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      question_id: questionId,
      text: answerText
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    console.error("Error sending response to Meli:", errorData);
    throw new Error(`Failed to answer question ${questionId}`);
  }

  return response.json();
}
