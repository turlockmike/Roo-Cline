/**
 * Error thrown when there's a problem executing an MCP tool
 */
export class McpToolError extends Error {
  constructor(public serverName: string, public toolName: string, public originalError: Error) {
    super(`Error executing ${serverName}/${toolName}: ${originalError.message}`)
    this.name = 'McpToolError'
  }
}

/**
 * Error thrown when there's a problem with MCP configuration
 */
export class McpConfigError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(`MCP configuration error: ${message}`)
    this.name = 'McpConfigError'
  }
}
