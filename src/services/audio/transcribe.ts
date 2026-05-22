import { openai } from "@/lib/ai/openai";
import { logger } from "@/lib/errors/logger";

export async function transcribeAudio(buffer: Buffer, fileName: string = "audio.ogg"): Promise<string> {
  try {
    const file = new File([new Uint8Array(buffer)], fileName, { type: "audio/ogg" });
    
    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es", // Asumimos español para Stockly
    });
    
    return response.text;
  } catch (error) {
    logger.error(error, "AUDIO_TRANSCRIBE");
    throw error;
  }
}
