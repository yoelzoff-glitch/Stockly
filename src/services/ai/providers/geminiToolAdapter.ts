import type { FunctionDeclaration, Part } from "@google/genai";
import { AgentTool } from "./types";

export class ToolSchemaError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ToolSchemaError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates that an AgentTool adheres to the strict schema contract required
 * by Gemini function calling before sending declarations to the model.
 */
export function validateToolSchema(tool: AgentTool): void {
  if (!tool || typeof tool !== "object") {
    throw new ToolSchemaError("AI_TOOL_SCHEMA_INVALID", "Tool definition must be an object");
  }

  if (!tool.name || typeof tool.name !== "string" || tool.name.trim().length === 0) {
    throw new ToolSchemaError("AI_TOOL_SCHEMA_INVALID", "Tool name must be a non-empty string");
  }

  if (!tool.description || typeof tool.description !== "string" || tool.description.trim().length === 0) {
    throw new ToolSchemaError(
      "AI_TOOL_SCHEMA_INVALID",
      `Tool '${tool.name}' must have a non-empty description`
    );
  }

  if (!tool.parameters || typeof tool.parameters !== "object" || tool.parameters.type !== "object") {
    throw new ToolSchemaError(
      "AI_TOOL_SCHEMA_INVALID",
      `Tool '${tool.name}' parameters must be an object with type 'object'`
    );
  }

  if (!tool.parameters.properties || typeof tool.parameters.properties !== "object") {
    throw new ToolSchemaError(
      "AI_TOOL_SCHEMA_INVALID",
      `Tool '${tool.name}' parameters.properties must be a valid object`
    );
  }

  if (tool.parameters.required !== undefined && !Array.isArray(tool.parameters.required)) {
    throw new ToolSchemaError(
      "AI_TOOL_SCHEMA_INVALID",
      `Tool '${tool.name}' parameters.required must be an array of strings if defined`
    );
  }
}

/**
 * Maps LibretaX canonical AgentTools to @google/genai FunctionDeclarations.
 * Strictly uses parametersJsonSchema instead of parameters to adhere to SDK 2.x contract.
 */
export function toGeminiFunctionDeclarations(tools: AgentTool[]): FunctionDeclaration[] {
  return tools.map((tool) => {
    validateToolSchema(tool);

    return {
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.parameters,
    };
  });
}

/**
 * Maps a tool execution result into a Gemini FunctionResponse Part,
 * strictly preserving FunctionCall.id when present without inventing dummy IDs when missing.
 */
export function toGeminiFunctionResponse(
  call: { id?: string; name?: string },
  toolResult: any
): Part {
  const trimmedId = typeof call.id === "string" && call.id.trim().length > 0 ? call.id.trim() : undefined;
  const toolName = call.name || "";

  const responsePayload =
    typeof toolResult === "object" && toolResult !== null
      ? toolResult
      : { result: toolResult };

  return {
    functionResponse: {
      ...(trimmedId ? { id: trimmedId } : {}),
      name: toolName,
      response: responsePayload,
    },
  } as Part;
}
