export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any) => Promise<any>;
}

export interface AgentResult {
  response: string;
  product_id?: string | null;
  duplicate?: boolean;
  metadata: {
    provider: string;
    model: string;
    toolsUsed: string[];
    fallbackCount: number;
    durationMs?: number;
  };
}

export interface AIProviderInput {
  systemPrompt: string;
  userMessage: string;
  messages?: AgentMessage[];
  tools: AgentTool[];
  tenantId?: string;
  correlationId?: string;
  model?: string;
}

export interface AIProvider {
  name: string;
  runAgent(input: AIProviderInput): Promise<AgentResult>;
}
