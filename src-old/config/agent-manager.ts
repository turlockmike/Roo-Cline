import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfigPaths, createConfigDirectories } from './config-paths';
import { AgentConfig, AgentConfigSchema, DEFAULT_CODE_ASSISTANT, DEFAULT_CODE_REVIEWER } from './agent-config';
import { ToolManager } from './ToolManager';
import { ALL_TOOLS } from '../core/tools';

/**
 * Manager for agent configurations
 * Handles CRUD operations for agent configurations stored in the agents directory
 */
export class AgentManager {
  private agentsDir: string;
  private toolManager: ToolManager;

  constructor() {
    // Ensure config directories exist
    createConfigDirectories();
    const paths = getConfigPaths();
    this.agentsDir = paths.agentsDir;
    this.toolManager = new ToolManager();
  }

  /**
   * List all available agent configurations
   * @returns Array of agent configuration names
   */
  async listAgents(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.agentsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      return [];
    }
  }

  /**
   * Get a specific agent configuration
   * @param name Agent configuration name
   * @returns Agent configuration object
   * @throws Error if agent configuration not found or invalid
   */
  async getAgent(name: string): Promise<AgentConfig> {
    const filePath = path.join(this.agentsDir, `${name}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(data);
      return AgentConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Agent configuration '${name}' not found or invalid: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new agent configuration
   * @param name Agent configuration name
   * @param config Agent configuration object
   * @throws Error if agent configuration already exists or is invalid
   */
  async createAgent(name: string, config: AgentConfig): Promise<void> {
    const filePath = path.join(this.agentsDir, `${name}.json`);
    
    try {
      // Check if file already exists
      await fs.access(filePath);
      // If we get here, the file exists, so throw an error
      throw new Error(`Agent configuration '${name}' already exists`);
    } catch (error: any) {
      // Only proceed if error is that file doesn't exist (ENOENT)
      if (error.code !== 'ENOENT') {
        // If this is our own error about the file already existing, rethrow it
        if (error instanceof Error && error.message.includes('already exists')) {
          throw error;
        }
        // Otherwise throw an unexpected error
        throw error;
      }
      
      // Validate configuration
      AgentConfigSchema.parse(config);
      
      // Validate tool references
      if (config.tools && config.tools.length > 0) {
        await this.validateToolReferences(config.tools);
      }
      
      // Write configuration to file
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    }
  }

  /**
   * Update an existing agent configuration
   * @param name Agent configuration name
   * @param updates Agent configuration updates
   * @throws Error if agent configuration not found or is invalid
   */
  async updateAgent(name: string, updates: Partial<AgentConfig>): Promise<void> {
    const filePath = path.join(this.agentsDir, `${name}.json`);
    
    try {
      // Check if file exists and get current config
      const currentConfig = await this.getAgent(name);
      
      // Update config with new values
      const updatedConfig = {
        ...currentConfig,
        ...updates
      };
      
      // Validate the updated configuration
      AgentConfigSchema.parse(updatedConfig);
      
      // Validate tool references
      if (updatedConfig.tools && updatedConfig.tools.length > 0) {
        await this.validateToolReferences(updatedConfig.tools);
      }
      
      // Write updated configuration to file
      await fs.writeFile(filePath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to update agent '${name}': ${(error as Error).message}`);
    }
  }

  /**
   * Delete an agent configuration
   * @param name Agent configuration name
   * @throws Error if agent configuration not found
   */
  async deleteAgent(name: string): Promise<void> {
    const filePath = path.join(this.agentsDir, `${name}.json`);
    
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Agent configuration '${name}' not found`);
      }
      // Only re-throw known errors, convert unknown errors to a standard message
      throw error instanceof Error ? error : new Error(`Unknown error occurred: ${error}`);
    }
  }

  /**
   * Validate tool references in an agent configuration
   * @param tools Array of tool names
   * @throws Error if a referenced tool doesn't exist (except for 'hataraku')
   */
  private async validateToolReferences(tools: string[]): Promise<void> {
    const availableTools = await this.toolManager.listTools();
    
    for (const tool of tools) {
      // Skip validation for built-in tools
      if (tool === 'hataraku') continue;
      
      if (!availableTools.includes(tool)) {
        throw new Error(`Referenced tool '${tool}' not found`);
      }
    }
  }

  /**
   * Initialize default agent configurations
   * Creates default agent configurations if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    const agents = await this.listAgents();
    
    // Create default code assistant if not exists
    if (!agents.includes('code-assistant')) {
      await this.createAgent('code-assistant', DEFAULT_CODE_ASSISTANT);
    }
    
    // Create default code reviewer if not exists
    if (!agents.includes('code-reviewer')) {
      await this.createAgent('code-reviewer', DEFAULT_CODE_REVIEWER);
    }
  }

  /**
   * Resolve tool references for an agent
   * Converts tool references to actual tool configurations
   * @param name Agent name
   * @returns Agent with resolved tool configurations
   * @throws Error if agent configuration not found
   */
  async resolveAgentTools(name: string): Promise<AgentConfig & { resolvedTools: string[] }> {
    const agent = await this.getAgent(name);
    const resolvedTools: string[] = [];
    
    if (agent.tools && agent.tools.length > 0) {
      for (const tool of agent.tools) {
        if (tool === 'hataraku') {
          // Add built-in Hataraku tools from ALL_TOOLS
          // Convert underscore-based tool names to hyphen-based names
          resolvedTools.push(
            ...Object.keys(ALL_TOOLS).map(toolName => toolName.replace(/_/g, '-'))
          );
        } else {
          // For other tools, add the tool name as-is
          // Actual tool resolution will happen when the agent is created
          resolvedTools.push(tool);
        }
      }
    }
    
    return {
      ...agent,
      resolvedTools
    };
  }
}