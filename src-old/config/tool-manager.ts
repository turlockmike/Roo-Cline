import * as fs from 'fs/promises'
import * as path from 'path'
import { getConfigPaths, createConfigDirectories } from './config-paths'
import { ToolsConfig, ToolsConfigSchema, ToolSetConfig, DEFAULT_AI_TOOLS, DEFAULT_DEV_TOOLS } from './tool-config'
import { interpolateEnvVarsInObject } from '../utils/env-interpolation'

/**
 * Manager for tool (MCP server) configurations
 * Handles CRUD operations for tool configurations stored in the tools directory
 */
export class ToolManager {
  private toolsDir: string

  constructor() {
    // Ensure config directories exist
    createConfigDirectories()
    const paths = getConfigPaths()
    this.toolsDir = paths.toolsDir
  }

  /**
   * List all available tool configurations
   * @returns Array of tool configuration names
   */
  async listTools(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.toolsDir)
      return files.filter(file => file.endsWith('.json')).map(file => path.basename(file, '.json'))
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      return []
    }
  }

  /**
   * Get a specific tool configuration
   * @param name Tool configuration name
   * @returns Tool configuration object
   * @throws Error if tool configuration not found or invalid
   */
  async getTool(name: string): Promise<ToolsConfig> {
    const filePath = path.join(this.toolsDir, `${name}.json`)

    try {
      const data = await fs.readFile(filePath, 'utf-8')
      const config = JSON.parse(data)
      return ToolsConfigSchema.parse(config)
    } catch (error) {
      throw new Error(`Tool configuration '${name}' not found or invalid: ${(error as Error).message}`)
    }
  }

  /**
   * Create a new tool configuration
   * @param name Tool configuration name
   * @param config Tool configuration object
   * @throws Error if tool configuration already exists or is invalid
   */
  async createTool(name: string, config: ToolsConfig): Promise<void> {
    const filePath = path.join(this.toolsDir, `${name}.json`)

    try {
      // Check if file already exists
      await fs.access(filePath)
      // If we get here, the file exists, so throw an error
      throw new Error(`Tool configuration '${name}' already exists`)
    } catch (error: any) {
      // Only proceed if error is that file doesn't exist (ENOENT)
      if (error.code !== 'ENOENT') {
        // If this is our own error about the file already existing, rethrow it
        if (error instanceof Error && error.message.includes('already exists')) {
          throw error
        }
        // Otherwise throw an unexpected error
        throw error
      }

      // Validate configuration
      ToolsConfigSchema.parse(config)

      // Write configuration to file
      await fs.writeFile(filePath, JSON.stringify(config, null, 2))
    }
  }

  /**
   * Update an existing tool configuration
   * @param name Tool configuration name
   * @param config Tool configuration object
   * @throws Error if tool configuration not found or is invalid
   */
  async updateTool(name: string, config: ToolsConfig): Promise<void> {
    const filePath = path.join(this.toolsDir, `${name}.json`)

    try {
      // Check if file exists
      await fs.access(filePath)

      // Validate configuration
      ToolsConfigSchema.parse(config)

      // Write configuration to file
      await fs.writeFile(filePath, JSON.stringify(config, null, 2))
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Tool configuration '${name}' not found`)
      }
      // Only re-throw known errors, convert unknown errors to a standard message
      throw error instanceof Error ? error : new Error(`Unknown error occurred: ${error}`)
    }
  }

  /**
   * Delete a tool configuration
   * @param name Tool configuration name
   * @throws Error if tool configuration not found
   */
  async deleteTool(name: string): Promise<void> {
    const filePath = path.join(this.toolsDir, `${name}.json`)

    try {
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Tool configuration '${name}' not found`)
      }
      // Only re-throw known errors, convert unknown errors to a standard message
      throw error instanceof Error ? error : new Error(`Unknown error occurred: ${error}`)
    }
  }

  /**
   * Enable a specific tool or capability
   * @param name Tool configuration name
   * @param toolName Optional specific tool/capability name to enable
   * @throws Error if tool configuration not found
   */
  async enableTool(name: string, toolName?: string): Promise<void> {
    const config = await this.getTool(name)

    if (toolName) {
      // Enable a specific capability within a tool configuration
      for (const server of config.mcpServers) {
        // Remove from disabledTools if present
        if (server.disabledTools) {
          server.disabledTools = server.disabledTools.filter(t => t !== toolName)
        }

        // Add to enabledTools if not already present
        if (!server.enabledTools) {
          server.enabledTools = []
        }
        if (!server.enabledTools.includes(toolName)) {
          server.enabledTools.push(toolName)
        }
      }
    } else {
      // When enabling all capabilities:
      // Clear disabledTools to allow all tools
      for (const server of config.mcpServers) {
        server.disabledTools = []
      }
    }

    await this.updateTool(name, config)
  }

  /**
   * Disable a specific tool or capability
   * @param name Tool configuration name
   * @param toolName Optional specific tool/capability name to disable
   * @throws Error if tool configuration not found
   */
  async disableTool(name: string, toolName?: string): Promise<void> {
    const config = await this.getTool(name)

    if (toolName) {
      // Disable a specific capability within a tool configuration
      for (const server of config.mcpServers) {
        // Remove from enabledTools if present
        if (server.enabledTools) {
          server.enabledTools = server.enabledTools.filter(t => t !== toolName)
        }

        // Add to disabledTools if not already present
        if (!server.disabledTools) {
          server.disabledTools = []
        }
        if (!server.disabledTools.includes(toolName)) {
          server.disabledTools.push(toolName)
        }
      }
    } else {
      // When disabling all capabilities:
      // Clear enabledTools (no whitelist)
      for (const server of config.mcpServers) {
        server.enabledTools = []
      }
    }

    await this.updateTool(name, config)
  }

  /**
   * Initialize default tool configurations
   * Creates default tool configurations if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    const tools = await this.listTools()

    // Create default AI tools if not exists
    if (!tools.includes('ai-tools')) {
      await this.createTool('ai-tools', DEFAULT_AI_TOOLS)
    }

    // Create default dev tools if not exists
    if (!tools.includes('dev-tools')) {
      await this.createTool('dev-tools', DEFAULT_DEV_TOOLS)
    }
  }

  /**
   * Get tool configuration with environment variables interpolated
   * @param name Tool configuration name
   * @returns Tool configuration with environment variables resolved
   * @throws Error if tool configuration not found
   */
  async getResolvedToolConfig(name: string): Promise<ToolsConfig> {
    const config = await this.getTool(name)

    // Interpolate environment variables in the configuration
    return interpolateEnvVarsInObject(config)
  }
}
