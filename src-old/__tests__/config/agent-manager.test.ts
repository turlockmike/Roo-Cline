import * as fs from 'fs/promises'
import * as path from 'path'
import { AgentManager } from '../../config/agent-manager'
import { AgentConfig, DEFAULT_CODE_ASSISTANT } from '../../config/agent-config'
import { getConfigPaths } from '../../config/config-paths'
import { ToolManager } from '../../config/tool-manager'

jest.mock('../../config/config-paths', () => ({
  getConfigPaths: jest.fn(),
  createConfigDirectories: jest.fn(),
}))

jest.mock('../../config/tool-manager')
jest.mock('fs/promises')

describe('AgentManager', () => {
  const mockAgentsDir = '/mock/agents/dir'
  let agentManager: AgentManager

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getConfigPaths as jest.Mock).mockReturnValue({
      agentsDir: mockAgentsDir,
    })
    agentManager = new AgentManager()
  })

  describe('listAgents', () => {
    it('should return a list of agent names', async () => {
      ;(fs.readdir as jest.Mock).mockResolvedValue(['agent1.json', 'agent2.json', 'not-an-agent.txt'])

      const result = await agentManager.listAgents()

      expect(result).toEqual(['agent1', 'agent2'])
      expect(fs.readdir).toHaveBeenCalledWith(mockAgentsDir)
    })

    it('should return an empty array if directory reading fails', async () => {
      ;(fs.readdir as jest.Mock).mockRejectedValue(new Error('Directory not found'))

      const result = await agentManager.listAgents()

      expect(result).toEqual([])
    })
  })

  describe('getAgent', () => {
    it('should return an agent configuration', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        name: 'test-agent',
      }

      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgent))

      const result = await agentManager.getAgent('test-agent')

      expect(result).toEqual(mockAgent)
      expect(fs.readFile).toHaveBeenCalledWith(path.join(mockAgentsDir, 'test-agent.json'), 'utf-8')
    })

    it('should throw an error if agent not found', async () => {
      ;(fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'))

      await expect(agentManager.getAgent('nonexistent')).rejects.toThrow(/not found or invalid/)
    })
  })

  describe('createAgent', () => {
    it('should create a new agent configuration', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        name: 'new-agent',
      }

      // File doesn't exist check
      const accessError = new Error('File not found')
      ;(accessError as any).code = 'ENOENT'
      ;(fs.access as jest.Mock).mockRejectedValue(accessError)

      // Mock tool validation
      ;(ToolManager.prototype.listTools as jest.Mock).mockResolvedValue(['ai-tools', 'github-tools'])

      await agentManager.createAgent('new-agent', mockAgent)

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockAgentsDir, 'new-agent.json'),
        JSON.stringify(mockAgent, null, 2),
      )
    })

    it('should throw an error if agent already exists', async () => {
      ;(fs.access as jest.Mock).mockResolvedValue(undefined) // File exists

      await expect(agentManager.createAgent('existing-agent', DEFAULT_CODE_ASSISTANT)).rejects.toThrow(/already exists/)
    })

    it('should validate tool references', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        tools: ['hataraku', 'nonexistent-tool'],
      }

      // File doesn't exist check
      const accessError = new Error('File not found')
      ;(accessError as any).code = 'ENOENT'
      ;(fs.access as jest.Mock).mockRejectedValue(accessError)

      // Mock tool validation - nonexistent-tool not in the list
      ;(ToolManager.prototype.listTools as jest.Mock).mockResolvedValue(['ai-tools', 'github-tools'])

      await expect(agentManager.createAgent('new-agent', mockAgent)).rejects.toThrow(
        /Referenced tool 'nonexistent-tool' not found/,
      )
    })
  })

  describe('updateAgent', () => {
    it('should update an existing agent configuration', async () => {
      const existingAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        name: 'existing-agent',
      }

      const updates: Partial<AgentConfig> = {
        description: 'Updated description',
      }

      const expectedUpdated = {
        ...existingAgent,
        ...updates,
      }

      // Mock getting the existing agent
      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(existingAgent))

      // Mock tool validation
      ;(ToolManager.prototype.listTools as jest.Mock).mockResolvedValue(['ai-tools', 'github-tools'])

      await agentManager.updateAgent('existing-agent', updates)

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockAgentsDir, 'existing-agent.json'),
        JSON.stringify(expectedUpdated, null, 2),
      )
    })

    it('should throw an error if agent does not exist', async () => {
      ;(fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'))

      await expect(agentManager.updateAgent('nonexistent', { description: 'New description' })).rejects.toThrow(
        /not found or invalid/,
      )
    })
  })

  describe('deleteAgent', () => {
    it('should delete an agent configuration', async () => {
      ;(fs.unlink as jest.Mock).mockResolvedValue(undefined)

      await agentManager.deleteAgent('test-agent')

      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockAgentsDir, 'test-agent.json'))
    })

    it('should throw an error if agent not found', async () => {
      const error = new Error('File not found')
      ;(error as any).code = 'ENOENT'
      ;(fs.unlink as jest.Mock).mockRejectedValue(error)

      await expect(agentManager.deleteAgent('nonexistent')).rejects.toThrow(/not found/)
    })
  })

  describe('initializeDefaults', () => {
    it("should create default agents if they don't exist", async () => {
      // No existing agents
      ;(fs.readdir as jest.Mock).mockResolvedValue([])

      // File doesn't exist check for creation
      const accessError = new Error('File not found')
      ;(accessError as any).code = 'ENOENT'
      ;(fs.access as jest.Mock).mockRejectedValue(accessError)

      // Mock tool validation
      ;(ToolManager.prototype.listTools as jest.Mock).mockResolvedValue(['ai-tools', 'github-tools'])

      await agentManager.initializeDefaults()

      // Should create both default agents
      expect(fs.writeFile).toHaveBeenCalledTimes(2)
    })

    it('should not create default agents if they already exist', async () => {
      // Both default agents exist
      ;(fs.readdir as jest.Mock).mockResolvedValue(['code-assistant.json', 'code-reviewer.json'])

      await agentManager.initializeDefaults()

      // Should not create any agents
      expect(fs.writeFile).not.toHaveBeenCalled()
    })
  })

  describe('resolveAgentTools', () => {
    it('should resolve hataraku tools to built-in tools', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        tools: ['hataraku'],
      }

      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgent))

      const result = await agentManager.resolveAgentTools('test-agent')

      expect(result.resolvedTools).toContain('search-files')
      expect(result.resolvedTools).toContain('write-file')
      expect(result.resolvedTools).toContain('read-file')
      // Should include all built-in tools
      expect(result.resolvedTools.length).toBeGreaterThan(10)
    })

    it('should include external tools as-is', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        tools: ['hataraku', 'github-tools'],
      }

      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgent))

      const result = await agentManager.resolveAgentTools('test-agent')

      expect(result.resolvedTools).toContain('github-tools')
      // Should also include all built-in tools
      expect(result.resolvedTools).toContain('search-files')
    })

    it('should handle agents with no tools', async () => {
      const mockAgent: AgentConfig = {
        ...DEFAULT_CODE_ASSISTANT,
        tools: [],
      }

      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockAgent))

      const result = await agentManager.resolveAgentTools('test-agent')

      expect(result.resolvedTools).toEqual([])
    })
  })
})
