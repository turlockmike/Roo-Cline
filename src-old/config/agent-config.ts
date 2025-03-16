import { z } from 'zod';

/**
 * Schema for model parameters configuration
 * Defines common parameters for language models
 */
export const ModelParametersSchema = z.object({
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().int().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().positive().int().optional(),
  presencePenalty: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
}).optional();

/**
 * Schema for model configuration
 * Defines the language model to use with an agent
 */
export const ModelConfigSchema = z.object({
  provider: z.string(),
  name: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional()
});

/**
 * Schema for agent configuration
 * Defines the structure for an agent configuration file
 */
export const AgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  role: z.string(),
  model: ModelConfigSchema,
  tools: z.array(z.string()).optional(),
  maxSteps: z.number().int().positive().optional(),
  maxRetries: z.number().int().positive().optional(),
  verbose: z.boolean().optional(),
  enableCaching: z.boolean().optional().default(true)
});

// TypeScript types
export type ModelParameters = z.infer<typeof ModelParametersSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Default agent configuration
 * Basic code assistant with Claude model
 */
export const DEFAULT_CODE_ASSISTANT: AgentConfig = {
  name: "Code Assistant",
  description: "A general purpose coding assistant",
  role: "You are a helpful coding assistant. You help users write, debug, and understand code.",
  model: {
    provider: "anthropic",
    name: "claude-3-7-sonnet-20250219",
    parameters: {
      temperature: 0.7,
      maxTokens: 4000
    }
  },
  tools: ["hataraku"], // Includes all built-in Hataraku tools
  maxSteps: 5,
  maxRetries: 3,
  enableCaching: true
};

/**
 * Default review agent configuration
 * Specialized agent for code reviews
 */
export const DEFAULT_CODE_REVIEWER: AgentConfig = {
  name: "Code Reviewer",
  description: "Expert code review agent",
  role: "You are an expert code reviewer. You analyze code for bugs, security issues, and best practices.",
  model: {
    provider: "anthropic",
    name: "claude-3-7-sonnet-20250219",
    parameters: {
      temperature: 0.3,
      maxTokens: 8000
    }
  },
  tools: ["hataraku"],
  maxSteps: 10,
  maxRetries: 3
};