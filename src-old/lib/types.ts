import type { Tool as MCPTool, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";


export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ImageBlock {
    type: 'image';
    image_url: {
        url: string;
    };
}

export interface ToolUseBlock {
    type: 'tool_use';
    tool_name: string;
    parameters: Record<string, string>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    result: string;
}

export type MessageBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export type ToolResponse = string | MessageBlock[];

export interface MessageParser {
    parseToolUse(message: string): {
        name: string;
        params: Record<string, string>;
    } | null;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    role: MessageRole;
    content: string;
}

export interface ApiClient {
    sendMessage(history: Message[]): Promise<string>;
}

export interface Tool {
    name: string;
    description: string | ((cwd: string) => string);
    parameters: {
        [key: string]: {
            required: boolean;
            description: string | ((cwd: string) => string);
        };
    };
}

export interface StreamHandler {
    stream: (data: string, resolve?: (value: any) => void) => void;
    finalize?: (resolve?: (value: any) => void) => void;
}


// New unified tool interface that extends Tool
export interface UnifiedTool<TInput = any, TOutput = any> extends Tool {
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties: boolean;
    };
    outputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
        additionalProperties: boolean;
    };
    execute: (params: TInput, cwd: string) => Promise<TOutput>;
    // Optional initialization method for tools that need setup
    initialize?: () => void;
    // Optional stream handler for tools that handle streaming content
    streamHandler?: StreamHandler;
}

export type HatarakuToolResult = {
    isError?: boolean;
    content: MessageBlock[];
}

export interface HatarakuTool<TInput = any> extends MCPTool {
    execute: (params: TInput) => Promise<HatarakuToolResult>;
    initialize?: () => void;
    streamHandler?: StreamHandler;
}

export interface CliConfig {
    mode?: string;
    mcpEnabled?: boolean;
    alwaysApproveResubmit?: boolean;
    requestDelaySeconds?: number;
    browserViewportSize?: { width: number; height: number };
    preferredLanguage?: string;
    customPrompts?: Record<string, string>;
}

export interface ToolDefinition {
  name: string;
  streamHandler?: (toolName: string, toolStream: AsyncGenerator<string, void, void>) => Promise<void>;
}

export interface TaskMetadata {
    taskId: string;
    input: string;
    errors?: any;
    totalSteps: number;
    toolCalls: { 
      name: string; 
      params: any; 
      result?: any;
      stepNumber: number;
    }[];
    usage: {
      cacheReads: number;
      cacheWrites: number;
      cost: number;
      tokensIn: number;
      tokensOut: number;
    };
  }
  
  /**
  * Composite result of a task execution.
  * Contains a streaming async iterator, a promise for the final result and a promise for metadata.
  */
  export interface StreamingTaskOutput<T> {
    stream: AsyncGenerator<string, T>;
    content: Promise<T>;
    metadata: Promise<TaskMetadata>;
  }
  
  /**
  * Non-streaming task output.
  * Contains the final result and metadata directly.
  */
  export interface NonStreamingTaskOutput<T> {
    content: T;
    metadata: TaskMetadata;
  }
  
  /**
  * Represents a single step in the agent's task execution process
  */
  export interface AgentStep {
    thinking: string[];
    toolCalls: Array<{
      name: string;
      content: string;
      params: any;
      result: any;
    }>;
    completion?: string;
    metadata: {
      tokensIn?: number;
      tokensOut?: number;
      cost?: number;
    };
  }