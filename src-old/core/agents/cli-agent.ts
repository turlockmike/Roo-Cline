import { LanguageModelV1 } from 'ai';
import { createAgent } from '../agent';
import { getEnvironmentInfo, getAgentRules } from '../prompts';
import { TaskHistory } from '../task-history';
import { ALL_TOOLS } from '../tools';
import { getMcpTools } from '../mcp/toolWrapper';
import { ToolManager } from '../../config/ToolManager';
import { colors, log } from '../../utils/colors';

/**
 * Options for configuring the CLI agent.
 * @interface CLIAgentOptions
 */
export interface CLIAgentOptions {
  /**
   * Whether to enable verbose logging for the agent.
   * When true, the agent will output additional information about its operations.
   */
  verbose?: boolean;
}

/**
 * Creates a CLI agent with built-in tools and MCP tools.
 *
 * The agent is initialized with standard tools and attempts to load additional
 * MCP (Model-Code-Prompt) tools from the tool manager configurations.
 *
 * @param model - The language model to use for the agent
 * @param options - Configuration options for the CLI agent
 * @returns A promise that resolves to the created agent instance
 * @throws Will log a warning if MCP tools fail to load but won't throw an error
 *
 * @example
 * ```typescript
 * import { createCLIAgent } from './cli-agent';
 * import { openai } from 'ai';
 *
 * const model = openai('gpt-4');
 * const agent = await createCLIAgent(model, { verbose: true });
 * const response = await agent.run('What can you help me with?');
 * ```
 */
export async function createCLIAgent(model: LanguageModelV1 | Promise<LanguageModelV1>, options?: CLIAgentOptions) {
  const verbose = options?.verbose === true;
  
  // Initialize tools
  const tools = { ...ALL_TOOLS };
  if (verbose) {
    log.system('Initializing CLI agent with built-in tools');
  }
  
  try {
    // Get MCP tools from tool manager
    const toolManager = new ToolManager();
    await toolManager.initializeDefaults();
    
    // Get tool configurations
    const toolConfigs = await toolManager.listTools();
    
    if (verbose) {
      log.system(`Loading MCP tools from ${toolConfigs.length} configurations`);
    }
    
    // Load MCP tools for each configuration
    for (const toolConfig of toolConfigs) {
      try {
        if (verbose) {
          log.system(`Loading tool configuration: ${toolConfig}`);
        }
        
        const resolvedConfig = await toolManager.getResolvedToolConfig(toolConfig);
        
        // Convert to the format expected by getMcpTools
        const mcpConfig = {
          mcpServers: {}
        };
        
        for (const server of resolvedConfig.mcpServers) {
          mcpConfig.mcpServers[server.name] = {
            command: server.command,
            args: server.args || [],
            env: server.env || {},
            disabledTools: server.disabledTools
          };
        }
        
        // Get MCP tools for this configuration
        const { tools: mcpTools } = await getMcpTools({ config: mcpConfig });
        
        // Add MCP tools to the agent's tools
        Object.assign(tools, mcpTools);
      } catch (error) {
        console.warn(`Warning: Failed to load MCP tools for configuration '${toolConfig}':`, error);
      }
    }
  } catch (error) {
    console.warn('Warning: Failed to load MCP tools:', error);
  }
  
  // Create and return the agent
  return createAgent({
    name: 'CLI Agent',
    description: 'A helpful CLI agent that can answer questions and perform tasks',
    role: `
${getAgentRules()}
${getEnvironmentInfo()}`,
    model,
    taskHistory: new TaskHistory(),
    tools,
    verbose: verbose,
    enableCaching: true // Always enable caching for CLI agent
  });
} 