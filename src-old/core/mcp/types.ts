import type { ToolExecutionOptions } from 'ai';

/**
 * Base interface for MCP tool responses
 */
export interface McpToolResponse {
  content: Array<{
    type: string;
    text: string;
    stream?: ReadableStream;
  }>;
  isError: boolean;
}

/**
 * Parsed MCP tool response
 */
export interface ParsedMcpToolResponse<T = any> {
  data: T;
  raw: McpToolResponse;
}

/**
 * Base tool interface matching the AI package's Tool type
 */
export interface BaseTool<TArgs = any, TResult = any> {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: TArgs, options?: ToolExecutionOptions) => Promise<TResult>;
}

/**
 * MCP tool with proper typing
 */
export interface McpTool<TArgs = any, TResult = any> extends BaseTool<TArgs, ParsedMcpToolResponse<TResult>> {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Tool execution options
 */
export interface McpToolExecutionOptions extends ToolExecutionOptions {
  stream?: boolean;
}

/**
 * Error codes for MCP operations
 */
export enum ErrorCode {
  InvalidRequest = 'INVALID_REQUEST',
  MethodNotFound = 'METHOD_NOT_FOUND',
  ExecutionError = 'EXECUTION_ERROR',
  InvalidParams = 'INVALID_PARAMS'
}

/**
 * MCP error class
 */
export class McpError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'McpError';
  }
}

/**
 * Server response interface
 */
export interface ServerResult {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, unknown>;
    };
  }>;
  content?: Array<{
    type: string;
    text: string;
    stream?: ReadableStream;
  }>;
  _meta?: Record<string, unknown>;
  nextCursor?: string;
}

/**
 * Jira ticket interface
 */
export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  type: string;
  priority: string;
  assignee?: {
    name: string;
    email: string;
  };
  reporter?: {
    name: string;
    email: string;
  };
  description?: string;
  created?: string;
  updated?: string;
  url?: string;
}

/**
 * Arguments for Jira get ticket tool
 */
export interface JiraGetTicketArgs {
  ticketId: string;
}

/**
 * Jira get ticket tool type
 */
export type JiraGetTicketTool = McpTool<JiraGetTicketArgs, JiraTicket>;