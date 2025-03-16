import { z } from 'zod'

/**
 * Configuration for an MCP server
 */
export interface McpServerConfig {
  /** Command to run the server */
  command: string
  /** Arguments to pass to the command */
  args?: string[]
  /** Environment variables to set when running the server */
  env?: Record<string, string>
  /** List of tool names to disable from this server */
  disabledTools?: string[]
}

/**
 * Complete MCP configuration
 */
export interface McpConfig {
  /** Map of server names to their configurations */
  mcpServers: Record<string, McpServerConfig>
}

/**
 * Interpolate environment variables in a string
 * Supports ${VAR_NAME} syntax
 */
export function interpolateEnvVars(value: string): string {
  return value.replace(/\${([^}]+)}/g, (_, varName) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set`)
    }
    return envValue
  })
}

/**
 * Transform a string by interpolating environment variables
 */
const envString = z.string().transform(str => interpolateEnvVars(str))

/**
 * Transform an array of strings by interpolating environment variables
 */
const envStringArray = z.array(envString)

/**
 * Transform a record of strings by interpolating environment variables
 */
const envStringRecord = z.record(envString)

/**
 * Zod schema for validating MCP server configuration
 */
export const McpServerConfigSchema = z
  .object({
    command: envString,
    args: envStringArray.optional(),
    env: envStringRecord.optional(),
    disabledTools: z.array(z.string()).optional(),
  })
  .strict()
  .transform(
    (data): McpServerConfig => ({
      command: data.command,
      args: data.args || [],
      env: data.env,
      disabledTools: data.disabledTools,
    }),
  )

/**
 * Zod schema for validating complete MCP configuration
 */
export const McpConfigSchema = z
  .object({
    mcpServers: z.record(McpServerConfigSchema),
  })
  .strict()
  .transform(
    (data): McpConfig => ({
      mcpServers: data.mcpServers,
    }),
  )

/**
 * Type guard to check if a value is a valid MCP configuration
 */
export function isMcpConfig(value: unknown): value is McpConfig {
  return McpConfigSchema.safeParse(value).success
}

/**
 * Parse and validate MCP configuration, interpolating environment variables
 * @throws {Error} if validation fails or required environment variables are missing
 */
export function parseMcpConfig(value: unknown): McpConfig {
  const result = McpConfigSchema.safeParse(value)
  if (!result.success) {
    throw new Error(`Invalid MCP configuration: ${result.error.message}`)
  }
  return result.data
}
