import { getConfigPaths, createConfigDirectories } from './config-paths'
import { ProfileManager } from './profile-manager'
import { TaskManager } from './task-manager'
import { ToolManager } from './tool-manager'
import { AgentManager } from './agent-manager'
import { Profile } from './profile-config'
import { AgentConfig } from './agent-config'
import { TaskConfig } from './task-config'
import { ToolsConfig } from './tool-config'

/**
 * CLI options interface for configuration overrides
 */
export interface CliOptions {
  profile?: string
  provider?: string
  model?: string
  apiKey?: string
  stream?: boolean
  sound?: boolean
  verbose?: boolean
  tools?: string[]
  agent?: string
  region?: string
  kbId?: string // Knowledge Base ID for the knowledge-base provider
  withStream?: boolean
}

/**
 * Configuration Loader class
 * Handles loading all configuration types and resolving effective configuration based on overrides
 */
export class ConfigLoader {
  private profileManager: ProfileManager
  private toolManager: ToolManager
  private agentManager: AgentManager
  private taskManager: TaskManager

  constructor() {
    this.profileManager = new ProfileManager()
    this.toolManager = new ToolManager()
    this.agentManager = new AgentManager()
    this.taskManager = new TaskManager()
  }

  /**
   * Load all configurations
   * @returns Object containing all configurations
   */
  async loadConfig(): Promise<{
    profiles: string[]
    activeProfile: string
    tools: string[]
    agents: string[]
    tasks: string[]
  }> {
    const [profiles, activeProfile, tools, agents, tasks] = await Promise.all([
      this.profileManager.listProfiles(),
      this.profileManager.getActiveProfile().then(profile => profile.name),
      this.toolManager.listTools(),
      this.agentManager.listAgents(),
      this.taskManager.listTasks(),
    ])

    return {
      profiles,
      activeProfile,
      tools,
      agents,
      tasks,
    }
  }

  /**
   * Get effective configuration based on CLI options
   * @param cliOptions CLI options for overrides
   * @returns Effective configuration for execution
   */
  async getEffectiveConfig(cliOptions: CliOptions): Promise<{
    profile: Profile
    agent?: AgentConfig
    tools: string[]
  }> {
    // 1. Get active profile (or specified profile)
    const profileName = cliOptions.profile || (await this.profileManager.getActiveProfile()).name
    const profile = await this.profileManager.getProfile(profileName)
    // 2. Apply CLI overrides to profile
    const effectiveProfile: Profile = {
      ...profile,
      provider: cliOptions.provider || profile.provider,
      model: cliOptions.model || profile.model,
      tools: cliOptions.tools || profile.tools,
      options: {
        ...profile.options,
        stream: cliOptions.stream !== undefined ? cliOptions.stream : profile.options?.stream,
        sound: cliOptions.sound !== undefined ? cliOptions.sound : profile.options?.sound,
        verbose: cliOptions.verbose !== undefined ? cliOptions.verbose : profile.options?.verbose,
      },
    }

    // 3. Resolve agent if specified
    let agent: AgentConfig | undefined
    const agentName = cliOptions.agent || profile.agent

    if (agentName) {
      try {
        agent = await this.agentManager.getAgent(agentName)
      } catch (error) {
        // Agent not found, will use default model configuration
      }
    }

    // 4. Resolve tools
    let tools: string[] = []
    if (effectiveProfile.tools && effectiveProfile.tools.length > 0) {
      tools = effectiveProfile.tools
    }

    // 5. Return effective configuration
    return {
      profile: effectiveProfile,
      agent,
      tools,
    }
  }

  /**
   * Get environment variables from a tool configuration
   * @param tools Tool configuration names
   * @returns Environment variables
   */
  async resolveEnvironmentVariables(tools: string[]): Promise<Record<string, string>> {
    const env: Record<string, string> = {}

    for (const toolName of tools) {
      try {
        const toolConfig = await this.toolManager.getTool(toolName)

        for (const server of toolConfig.mcpServers) {
          if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
              // Handle environment variable interpolation (${VAR_NAME})
              const interpolatedValue = this.interpolateEnvVar(value)
              if (interpolatedValue !== undefined) {
                env[key] = interpolatedValue
              }
            }
          }
        }
      } catch (error) {
        // Skip if tool doesn't exist
      }
    }

    return env
  }

  /**
   * Interpolate environment variables in a string
   * @param value String with potential environment variable references
   * @returns Interpolated string or undefined if interpolation fails
   */
  private interpolateEnvVar(value: string): string | undefined {
    // If the value is a direct environment variable reference (${VAR_NAME})
    if (value.startsWith('${') && value.endsWith('}')) {
      const envName = value.substring(2, value.length - 1)
      return process.env[envName]
    }

    // Return the value as-is if it doesn't need interpolation
    return value
  }

  /**
   * Get a task configuration by name
   * @param name Task name
   * @returns Task configuration
   */
  async getTask(name: string): Promise<TaskConfig> {
    return this.taskManager.getTask(name)
  }

  /**
   * Initialize all configuration managers with default configurations
   */
  async initializeDefaults(): Promise<void> {
    await Promise.all([
      this.toolManager.initializeDefaults(),
      this.agentManager.initializeDefaults(),
      this.taskManager.initializeDefaults(),
    ])
  }
}
