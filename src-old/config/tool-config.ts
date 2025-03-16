import { z } from 'zod'

/**
 * Schema for individual MCP server configuration
 * Defines the structure for a single tool set (MCP server)
 */
export const ToolSetConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string().min(1), z.string().min(1)).optional(), // Ensure non-empty strings for both keys and values
  enabledTools: z.array(z.string()).optional(),
  disabledTools: z.array(z.string()).optional(),
})

/**
 * Schema for a collection of tool configurations
 * Defines the structure for a tool configuration file
 */
export const ToolsConfigSchema = z.object({
  mcpServers: z.array(ToolSetConfigSchema),
})

// TypeScript types
export type ToolSetConfig = z.infer<typeof ToolSetConfigSchema>
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>

/**
 * Default AI tools configuration
 * Empty by default, will be configured during setup
 */
export const DEFAULT_AI_TOOLS: ToolsConfig = {
  mcpServers: [],
}

/**
 * Default development tools configuration
 * Empty by default, will be configured during setup
 */
export const DEFAULT_DEV_TOOLS: ToolsConfig = {
  mcpServers: [],
}
