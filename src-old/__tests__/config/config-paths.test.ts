import { jest } from '@jest/globals'
import * as os from 'os'
import * as path from 'path'
import { getConfigPaths, createConfigDirectories } from '../../config/config-paths'

jest.mock('os', () => ({
  homedir: jest.fn(),
}))

type MockFS = {
  mkdirSync: jest.Mock
}

jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
}))

describe('Configuration Paths', () => {
  const mockHomedir = os.homedir as jest.MockedFunction<typeof os.homedir>
  const mockMkdir = (jest.requireMock('fs') as MockFS).mkdirSync
  const originalEnv = process.env

  beforeEach(() => {
    mockHomedir.mockReturnValue('/home/testuser')
    mockMkdir.mockImplementation(() => undefined)
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    jest.clearAllMocks()
    process.env = originalEnv
  })

  describe('getConfigPaths', () => {
    it('should use XDG_CONFIG_HOME when set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config'
      const paths = getConfigPaths()
      expect(paths.configDir).toBe(path.join('/custom/config', 'hataraku'))
    })

    it('should fallback to ~/.config when XDG_CONFIG_HOME is not set', () => {
      delete process.env.XDG_CONFIG_HOME
      const paths = getConfigPaths()
      expect(paths.configDir).toBe(path.join('/home/testuser', '.config', 'hataraku'))
    })

    it('should use XDG_DATA_HOME when set', () => {
      process.env.XDG_DATA_HOME = '/custom/data'
      const paths = getConfigPaths()
      expect(paths.dataDir).toBe(path.join('/custom/data', 'hataraku'))
    })

    it('should fallback to ~/.local/share when XDG_DATA_HOME is not set', () => {
      delete process.env.XDG_DATA_HOME
      const paths = getConfigPaths()
      expect(paths.dataDir).toBe(path.join('/home/testuser', '.local', 'share', 'hataraku'))
    })

    it('should return correct subdirectory paths', () => {
      const paths = getConfigPaths()
      expect(paths.toolsDir).toBe(path.join(paths.configDir, 'tools'))
      expect(paths.agentsDir).toBe(path.join(paths.configDir, 'agents'))
      expect(paths.tasksDir).toBe(path.join(paths.configDir, 'tasks'))
      expect(paths.logsDir).toBe(path.join(paths.dataDir, 'logs'))
    })
  })

  describe('createConfigDirectories', () => {
    it('should create all required directories', () => {
      const paths = getConfigPaths()
      createConfigDirectories()

      expect(mockMkdir).toHaveBeenCalledWith(paths.configDir, { recursive: true })
      expect(mockMkdir).toHaveBeenCalledWith(paths.toolsDir, { recursive: true })
      expect(mockMkdir).toHaveBeenCalledWith(paths.agentsDir, { recursive: true })
      expect(mockMkdir).toHaveBeenCalledWith(paths.tasksDir, { recursive: true })
      expect(mockMkdir).toHaveBeenCalledWith(paths.dataDir, { recursive: true })
      expect(mockMkdir).toHaveBeenCalledWith(paths.logsDir, { recursive: true })
    })

    it('should handle errors gracefully', () => {
      mockMkdir.mockImplementation(() => {
        throw new Error('Permission denied')
      })
      expect(() => createConfigDirectories()).toThrow('Failed to create configuration directories')
    })
  })
})
