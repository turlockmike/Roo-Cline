import * as fs from 'fs/promises'
import * as path from 'path'
import { FirstRunManager } from '../first-run-manager'
import { ConfigLoader } from '../config-loader'
import { ProfileManager } from '../profile-manager'
import { input, select, confirm } from '@inquirer/prompts'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('../config-loader')
jest.mock('../profile-manager')
jest.mock('@inquirer/prompts')
jest.mock('../config-paths', () => ({
  getConfigPaths: jest.fn().mockReturnValue({
    configDir: '/mock/config/dir',
  }),
  createConfigDirectories: jest.fn(),
}))

describe('FirstRunManager', () => {
  let firstRunManager: FirstRunManager
  let mockConfigLoader: jest.Mocked<ConfigLoader>
  let mockProfileManager: jest.Mocked<ProfileManager>

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Setup mock instances
    mockConfigLoader = new ConfigLoader() as jest.Mocked<ConfigLoader>
    mockProfileManager = new ProfileManager() as jest.Mocked<ProfileManager>

    // Provide mock implementations
    ;(ConfigLoader as jest.Mock).mockImplementation(() => mockConfigLoader)
    ;(ProfileManager as jest.Mock).mockImplementation(() => mockProfileManager)

    // Mock inquirer prompts
    ;(input as jest.Mock).mockResolvedValue('test-value')
    ;(select as jest.Mock).mockResolvedValue('test-selection')
    ;(confirm as jest.Mock).mockResolvedValue(true)

    // Create FirstRunManager instance
    firstRunManager = new FirstRunManager()
  })

  describe('isFirstRun', () => {
    it('should return true when config directory does not exist', async () => {
      // Setup mock implementation
      ;(fs.access as jest.Mock).mockRejectedValue(new Error('Directory not found'))

      // Call the method
      const result = await firstRunManager.isFirstRun()

      // Verify the result
      expect(result).toBe(true)
      expect(fs.access).toHaveBeenCalledWith('/mock/config/dir')
    })

    it('should return true when profiles.json does not exist', async () => {
      // Setup mock implementation
      ;(fs.access as jest.Mock).mockResolvedValueOnce(undefined)
      ;(fs.access as jest.Mock).mockRejectedValueOnce(new Error('File not found'))

      // Call the method
      const result = await firstRunManager.isFirstRun()

      // Verify the result
      expect(result).toBe(true)
      expect(fs.access).toHaveBeenCalledWith('/mock/config/dir')
      expect(fs.access).toHaveBeenCalledWith(path.join('/mock/config/dir', 'profiles.json'))
    })

    it('should return false when both config directory and profiles.json exist', async () => {
      // Setup mock implementation
      ;(fs.access as jest.Mock).mockResolvedValue(undefined)

      // Call the method
      const result = await firstRunManager.isFirstRun()

      // Verify the result
      expect(result).toBe(false)
      expect(fs.access).toHaveBeenCalledWith('/mock/config/dir')
      expect(fs.access).toHaveBeenCalledWith(path.join('/mock/config/dir', 'profiles.json'))
    })
  })

  describe('initializeDefaults', () => {
    it('should initialize default configurations', async () => {
      // Setup mock implementation
      mockConfigLoader.initializeDefaults.mockResolvedValue(undefined)

      // Call the method
      await firstRunManager.initializeDefaults()

      // Verify the calls
      expect(mockConfigLoader.initializeDefaults).toHaveBeenCalled()
    })
  })

  describe('createDefaultProfileWithWizard', () => {
    it('should create a profile with user inputs', async () => {
      // Setup mock implementations
      ;(input as jest.Mock).mockImplementation(options => {
        if (options.message.includes('Profile name')) {
          return 'test-profile'
        }
        if (options.message.includes('description')) {
          return 'Test profile description'
        }
        return 'other-value'
      })
      ;(select as jest.Mock).mockImplementation(options => {
        if (options.message.includes('provider')) {
          return 'anthropic'
        }
        if (options.message.includes('model')) {
          return 'claude-3-7-sonnet-20250219'
        }
        return 'other-selection'
      })
      ;(confirm as jest.Mock).mockImplementation(options => {
        if (options.message.includes('streaming')) {
          return true
        }
        if (options.message.includes('sound')) {
          return false
        }
        return false
      })

      mockProfileManager.createProfile.mockResolvedValue(undefined)

      // Call the method
      const result = await firstRunManager.createDefaultProfileWithWizard()

      // Verify the result
      expect(result).toEqual({
        name: 'test-profile',
        description: 'Test profile description',
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219',
        options: {
          stream: true,
          sound: false,
        },
      })

      // Verify the calls
      expect(mockProfileManager.createProfile).toHaveBeenCalledWith(result)
      expect(input).toHaveBeenCalledTimes(2)
      expect(select).toHaveBeenCalledTimes(2)
      expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('should update profile if it already exists', async () => {
      // Setup mock implementations
      mockProfileManager.createProfile.mockRejectedValue(new Error('Profile already exists'))
      mockProfileManager.updateProfile.mockResolvedValue(undefined)

      // Call the method
      await firstRunManager.createDefaultProfileWithWizard()

      // Verify the calls
      expect(mockProfileManager.updateProfile).toHaveBeenCalled()
    })
  })

  describe('runSetupWizard', () => {
    it('should run the setup wizard', async () => {
      // Setup spy for createDefaultProfileWithWizard
      const createProfileSpy = jest.spyOn(firstRunManager, 'createDefaultProfileWithWizard')
      createProfileSpy.mockResolvedValue({
        name: 'test-profile',
        description: 'Test description',
        provider: 'test-provider',
        model: 'test-model',
        options: { stream: true, sound: true },
      })

      // Setup mock implementation
      mockConfigLoader.initializeDefaults.mockResolvedValue(undefined)

      // Call the method
      await firstRunManager.runSetupWizard()

      // Verify the calls
      expect(createProfileSpy).toHaveBeenCalled()
      expect(mockConfigLoader.initializeDefaults).toHaveBeenCalled()
    })
  })
})
