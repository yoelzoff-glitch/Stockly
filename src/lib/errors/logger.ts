import { AppError } from "./AppError";

export const logger = {
  error: (err: Error | AppError | unknown, context?: string) => {
    // Aquí a futuro se puede integrar Sentry, Datadog, etc.
    const timestamp = new Date().toISOString();
    
    if (err instanceof AppError) {
      console.error(`[${timestamp}] [ERROR] [${err.code}] ${context ? `[${context}] ` : ''}${err.message}`);
      if (err.details) console.error("Details:", err.details);
    } else if (err instanceof Error) {
      console.error(`[${timestamp}] [ERROR] ${context ? `[${context}] ` : ''}${err.message}`);
      console.error(err.stack);
    } else {
      console.error(`[${timestamp}] [ERROR] ${context ? `[${context}] ` : ''}`, err);
    }
  },
  
  warn: (message: string, details?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`);
    if (details) console.warn("Details:", details);
  },

  info: (message: string, details?: any) => {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [INFO] ${message}`);
    if (details) console.info("Details:", details);
  }
};
