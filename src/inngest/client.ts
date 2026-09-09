import { Inngest } from "inngest";

// Create a client to send and receive events with persistent historical infrastructure identity
export const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || "klyvo-ai-operator",
});
