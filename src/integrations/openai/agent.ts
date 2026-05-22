export class AIAgent {
  constructor(private apiKey: string) {}

  async processQuery(query: string, context: any) {
    // Placeholder for OpenAI API
    console.log(`Processing query: ${query}`);
    return {
      intent: "unknown",
      response: "Esta es una respuesta simulada de la IA.",
    };
  }
}
