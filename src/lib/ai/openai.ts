import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("OPENAI_API_KEY is not defined in environment variables.");
}

export const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-to-prevent-crash",
});
