export type ErrorCode = 
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "OPERATION_BLOCKED"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR"
  | "MELI_API_ERROR"
  | "MELI_TOKEN_EXPIRED"
  | "OPENAI_ERROR"
  | "OPENAI_QUOTA_EXCEEDED"
  | "SUPABASE_ERROR"
  | "VALIDATION_ERROR"
  | "WHATSAPP_SEND_ERROR"
  | "WHATSAPP_MEDIA_ERROR"
  | "WHATSAPP_DOWNLOAD_ERROR"
  | "WHATSAPP_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
