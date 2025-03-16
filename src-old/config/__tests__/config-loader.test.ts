import { ConfigLoader } from '../config-loader'
import { ProfileManager } from '../profile-manager'
import { AgentManager } from '../agent-manager'
import { TaskManager } from '../task-manager'
import { ToolManager } from '../tool-manager'
import { Profile } from '../profile-config'
import { AgentConfig } from '../agent-config'

// Mock the managers
jest.mock('../profile-manager')
jest.mock('../agent-manager')
jest.mock('../task-manager')
jest.mock('../tool-manager')

describe('ConfigLoader', () => {
  let configLoader: ConfigLoader
  let mockProfileManager: jest.Mocked<ProfileManager>
  let mockAgentManager: jest.Mocked<AgentManager>
  let mockTaskManager: jest.Mocked<TaskManager>
  let mockToolManager: jest.Mocked<ToolManager>

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Setup mock instances
    mockProfileManager = new ProfileManager() as jest.Mocked<ProfileManager>
    mockAgentManager = new AgentManager() as jest.Mocked<AgentManager>
    mockTaskManager = new TaskManager() as jest.Mocked<TaskManager>
    mockToolManager = new ToolManager() as jest.Mocked<ToolManager>

    // Provide mock implementations
    ;(ProfileManager as jest.Mock).mockImplementation(() => mockProfileManager)
    ;(AgentManager as jest.Mock).mockImplementation(() => mockAgentManager)
    ;(TaskManager as jest.Mock).mockImplementation(() => mockTaskManager)
    ;(ToolManager as jest.Mock).mockImplementation(() => mockToolManager)

    // Create the ConfigLoader instance
    configLoader = new ConfigLoader()
  })

  describe('loadConfig', () => {
    it('should load all configurations', async () => {
      // Setup mock data
      const mockProfiles = ['default', 'dev']
      const mockActiveProfile = 'default'
      const mockTools = ['ai-tools', 'dev-tools']
      const mockAgents = ['code-assistant', 'code-reviewer']
      const mockTasks = ['code-review', 'explain-code']

      // Setup mock implementations
      mockProfileManager.listProfiles.mockResolvedValue(mockProfiles)
      mockProfileManager.getActiveProfile.mockResolvedValue({ name: mockActiveProfile } as Profile)
      mockToolManager.listTools.mockResolvedValue(mockTools)
      mockAgentManager.listAgents.mockResolvedValue(mockAgents)
      mockTaskManager.listTasks.mockResolvedValue(mockTasks)

      // Call the method
      const result = await configLoader.loadConfig()

      // Verify the result
      expect(result).toEqual({
        profiles: mockProfiles,
        activeProfile: mockActiveProfile,
        tools: mockTools,
        agents: mockAgents,
        tasks: mockTasks,
      })

      // Verify the calls
      expect(mockProfileManager.listProfiles).toHaveBeenCalled()
      expect(mockProfileManager.getActiveProfile).toHaveBeenCalled()
      expect(mockToolManager.listTools).toHaveBeenCalled()
      expect(mockAgentManager.listAgents).toHaveBeenCalled()
      expect(mockTaskManager.listTasks).toHaveBeenCalled()
    })
  })

  describe('getEffectiveConfig', () => {
    it('should merge profile and CLI options', async () => {
      // Setup mock data
      const mockProfile: Profile = {
        name: 'default',
        description: 'Default profile',
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        tools: ['ai-tools'],
        options: {
          stream: true,
          sound: true,
          verbose: false,
          maxRetries: 3,
          maxSteps: 50,
        },
      }

      const mockAgent: AgentConfig = {
        name: 'Code Assistant',
        description: 'A coding assistant',
        role: 'You are a coding assistant',
        model: {
          provider: 'anthropic',
          name: 'claude-3-7-sonnet-20250219',
        },
      }

      // Setup mock implementations
      mockProfileManager.getActiveProfile.mockResolvedValue(mockProfile)
      mockProfileManager.getProfile.mockResolvedValue(mockProfile)
      mockAgentManager.getAgent.mockResolvedValue(mockAgent)

      // Call with CLI options
      const cliOptions = {
        provider: 'openai',
        model: 'gpt-4',
        stream: false,
        agent: 'code-assistant', // Add agent name to CLI options
      }

      const result = await configLoader.getEffectiveConfig(cliOptions)

      // Verify the result
      expect(result.profile.provider).toBe('openai')
      expect(result.profile.model).toBe('gpt-4')
      expect(result.profile.options?.stream).toBe(false)
      expect(result.profile.options?.sound).toBe(true)
      expect(result.agent).toEqual(mockAgent)
    })

    it('should handle missing agent gracefully', async () => {
      // Setup mock data
      const mockProfile: Profile = {
        name: 'default',
        description: 'Default profile',
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        agent: 'non-existent-agent',
        options: {
          stream: true,
          sound: true,
          verbose: false,
          maxRetries: 3,
          maxSteps: 50,
        },
      }

      // Setup mock implementations
      mockProfileManager.getActiveProfile.mockResolvedValue(mockProfile)
      mockProfileManager.getProfile.mockResolvedValue(mockProfile)
      mockAgentManager.getAgent.mockRejectedValue(new Error('Agent not found'))

      // Call the method
      const result = await configLoader.getEffectiveConfig({})

      // Verify the result
      expect(result.profile).toEqual(mockProfile)
      expect(result.agent).toBeUndefined()
    })
  })

  describe('resolveEnvironmentVariables', () => {
    it('should resolve environment variables from tool configurations', async () => {
      // Save original environment variables
      const originalEnv = process.env
      process.env = { ...originalEnv, TEST_API_KEY: 'test-key-value' }

      try {
        // Setup mock data
        const mockToolConfig = {
          mcpServers: [
            {
              name: 'test-server',
              command: 'node',
              args: ['server.js'],
              env: {
                API_KEY: '${TEST_API_KEY}',
                STATIC_VALUE: 'static-value',
              },
            },
          ],
        }

        // Setup mock implementations
        mockToolManager.getTool.mockResolvedValue(mockToolConfig)

        // Call the method
        const result = await configLoader.resolveEnvironmentVariables(['test-tool'])

        // Verify the result
        expect(result).toEqual({
          API_KEY: 'test-key-value',
          STATIC_VALUE: 'static-value',
        })
      } finally {
        // Restore original environment variables
        process.env = originalEnv
      }
    })

    it('should handle missing environment variables gracefully', async () => {
      // Setup mock data
      const mockToolConfig = {
        mcpServers: [
          {
            name: 'test-server',
            command: 'node',
            args: ['server.js'],
            env: {
              API_KEY: '${NON_EXISTENT_ENV_VAR}',
              STATIC_VALUE: 'static-value',
            },
          },
        ],
      }

      // Setup mock implementations
      mockToolManager.getTool.mockResolvedValue(mockToolConfig)

      // Call the method
      const result = await configLoader.resolveEnvironmentVariables(['test-tool'])

      // Verify the result - undefined values shouldn't be included
      expect(result).toEqual({
        STATIC_VALUE: 'static-value',
      })
    })
  })

  describe('initializeDefaults', () => {
    it('should initialize all default configurations', async () => {
      // Setup mock implementations
      mockToolManager.initializeDefaults.mockResolvedValue(undefined)
      mockAgentManager.initializeDefaults.mockResolvedValue(undefined)
      mockTaskManager.initializeDefaults.mockResolvedValue(undefined)

      // Call the method
      await configLoader.initializeDefaults()

      // Verify the calls
      expect(mockToolManager.initializeDefaults).toHaveBeenCalled()
      expect(mockAgentManager.initializeDefaults).toHaveBeenCalled()
      expect(mockTaskManager.initializeDefaults).toHaveBeenCalled()
    })
  })
})
