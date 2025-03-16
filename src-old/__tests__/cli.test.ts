import { program, main } from '../cli' // adjust the path as needed
import { ConfigLoader } from '../config/config-loader'
import { ProfileManager } from '../config/profile-manager'

// Create mock function for ConfigLoader
const mockGetEffectiveConfig = jest.fn().mockResolvedValue({
  profile: {
    provider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    options: { stream: true, sound: true },
  },
  agent: null,
})

// --- Mocks for dependencies used in the CLI ---
jest.mock('../config/config-loader', () => {
  return {
    ConfigLoader: jest.fn().mockImplementation(() => {
      return {
        loadConfig: jest.fn().mockResolvedValue({
          activeProfile: 'default',
          profiles: [{ name: 'default', provider: 'openrouter', model: 'anthropic/claude-3-sonnet' }],
          agents: [],
          tools: [],
          tasks: [],
        }),
        getEffectiveConfig: mockGetEffectiveConfig,
        initializeDefaults: jest.fn().mockResolvedValue(undefined),
      }
    }),
  }
})

jest.mock('../config/profile-manager', () => {
  return {
    ProfileManager: jest.fn().mockImplementation(() => {
      return {
        getActiveProfile: jest.fn().mockResolvedValue({
          name: 'default',
          provider: 'openrouter',
          model: 'anthropic/claude-3-sonnet',
          options: { stream: true, sound: true },
        }),
      }
    }),
  }
})
jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => ({
    chat: jest.fn().mockReturnValue({
      task: jest.fn().mockResolvedValue('mocked openrouter result'),
    }),
  })),
}))

jest.mock('../core/providers/bedrock', () => {
  return {
    createBedrockModel: jest.fn().mockImplementation(() => {
      return {
        task: jest.fn().mockResolvedValue('mocked bedrock result'),
      }
    }),
  }
})

jest.mock('../core/agents', () => ({
  createCLIAgent: jest.fn(() => ({
    task: jest.fn().mockResolvedValue(''),
  })),
}))

jest.mock('../core/tools/play-audio', () => ({
  playAudioTool: {
    execute: jest.fn().mockResolvedValue('mocked play audio result'),
  },
}))

jest.mock('@inquirer/prompts', () => ({
  input: jest.fn().mockResolvedValue('interactive task'),
}))

// const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
//   throw new Error(`Process.exit called with code: ${code}`);
// });

// --- Import the CLI module under test ---

// --- Begin tests ---
describe('CLI Input Parameters', () => {
  let mockExit: jest.SpyInstance
  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new Error(`Process.exit called with code: ${code}`)
    })
    // Reset env vars before each test
    delete process.env.OPENROUTER_API_KEY
    // Reset Commander options
    program.opts().provider = undefined
    program.opts().model = undefined
    program.opts().apiKey = undefined
  })

  afterEach(() => {
    mockExit.mockRestore()
  })

  test('executes task in normal mode', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    // Set the environment variable for OpenRouter API key
    process.env.OPENROUTER_API_KEY = 'dummy'
    // Set the provider option
    program.setOptionValue('provider', 'openrouter')
    // Set the API key in the program options
    program.setOptionValue('apiKey', 'dummy')
    const code = await main('myTask', program)
    expect(code).toBe(0)
    consoleLogSpy.mockRestore()
  })

  test('errors when API key is missing for non-Bedrock provider', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    program.setOptionValue('provider', 'openrouter')
    const code = await main('task')
    expect(code).toBe(1)
    consoleErrorSpy.mockRestore()
  })

  test('succeeds with Bedrock provider without API key', async () => {
    // Mock the getEffectiveConfig for this test only
    mockGetEffectiveConfig.mockResolvedValueOnce({
      profile: {
        provider: 'bedrock',
        model: 'us.anthropic.claude-3-7-sonnet-20250219-v1.0',
        options: { stream: true, sound: true },
      },
      agent: null,
    })

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    program.setOptionValue('provider', 'bedrock')
    const code = await main('task', program)
    expect(code).toBe(0)
    consoleLogSpy.mockRestore()
  })

  test('errors when no task provided in non-interactive mode', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    const code = await main()
    expect(code).toBe(1)
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
