import * as fs from 'fs/promises'
import * as path from 'path'
import { TaskManager } from '../task-manager'
import { AgentManager } from '../agent-manager'
import { TaskConfig } from '../task-config'

// Mock fs and AgentManager
jest.mock('fs/promises')
jest.mock('../agent-manager')
jest.mock('../config-paths', () => ({
  getConfigPaths: jest.fn().mockReturnValue({
    tasksDir: '/mock/tasks/dir',
  }),
  createConfigDirectories: jest.fn(),
}))

describe('TaskManager', () => {
  let taskManager: TaskManager
  let mockAgentManager: jest.Mocked<AgentManager>

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Setup mock AgentManager
    mockAgentManager = new AgentManager() as jest.Mocked<AgentManager>
    ;(AgentManager as jest.Mock).mockImplementation(() => mockAgentManager)

    // Create TaskManager instance
    taskManager = new TaskManager()
  })

  describe('listTasks', () => {
    it('should list all tasks', async () => {
      // Setup mock data
      const mockFiles = ['task1.json', 'task2.json', 'not-a-task.txt']

      // Setup mock implementation
      ;(fs.readdir as jest.Mock).mockResolvedValue(mockFiles)

      // Call the method
      const result = await taskManager.listTasks()

      // Verify the result
      expect(result).toEqual(['task1', 'task2'])
      expect(fs.readdir).toHaveBeenCalledWith('/mock/tasks/dir')
    })

    it('should return empty array when directory does not exist', async () => {
      // Setup mock implementation
      ;(fs.readdir as jest.Mock).mockRejectedValue(new Error('Directory not found'))

      // Call the method
      const result = await taskManager.listTasks()

      // Verify the result
      expect(result).toEqual([])
    })
  })

  describe('getTask', () => {
    it('should get a task by name', async () => {
      // Setup mock data
      const mockTaskConfig: TaskConfig = {
        name: 'Code Review',
        description: 'Comprehensive code review',
        agent: 'code-reviewer',
        task: 'Review the code for bugs and best practices',
      }

      // Setup mock implementation
      ;(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockTaskConfig))

      // Call the method
      const result = await taskManager.getTask('code-review')

      // Verify the result
      expect(result).toEqual(mockTaskConfig)
      expect(fs.readFile).toHaveBeenCalledWith(path.join('/mock/tasks/dir', 'code-review.json'), 'utf-8')
    })

    it('should throw error when task does not exist', async () => {
      // Setup mock implementation
      ;(fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'))

      // Call the method and expect error
      await expect(taskManager.getTask('non-existent')).rejects.toThrow('Task configuration')
    })
  })

  describe('createTask', () => {
    it('should create a new task', async () => {
      // Setup mock data
      const mockTaskConfig: TaskConfig = {
        name: 'Code Review',
        description: 'Comprehensive code review',
        agent: 'code-reviewer',
        task: 'Review the code for bugs and best practices',
      }

      // Setup mock implementations
      ;(fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' })
      mockAgentManager.getAgent.mockResolvedValue({})
      ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)

      // Call the method
      await taskManager.createTask('code-review', mockTaskConfig)

      // Verify the calls
      expect(fs.access).toHaveBeenCalledWith(path.join('/mock/tasks/dir', 'code-review.json'))
      expect(mockAgentManager.getAgent).toHaveBeenCalledWith('code-reviewer')
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/mock/tasks/dir', 'code-review.json'),
        JSON.stringify(mockTaskConfig, null, 2),
      )
    })

    it('should throw error when task already exists', async () => {
      // Setup mock implementation
      ;(fs.access as jest.Mock).mockResolvedValue(undefined)

      // Call the method and expect error
      await expect(taskManager.createTask('existing-task', {} as TaskConfig)).rejects.toThrow('already exists')
    })

    it('should throw error when agent does not exist', async () => {
      // Setup mock implementations
      ;(fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' })
      mockAgentManager.getAgent.mockRejectedValue(new Error('Agent not found'))

      // Create a valid task config
      const taskConfig: TaskConfig = {
        name: 'Test Task',
        description: 'A test task',
        agent: 'non-existent-agent',
        task: 'This is a test task',
      }

      // Call the method and expect error
      await expect(taskManager.createTask('new-task', taskConfig)).rejects.toThrow('Referenced agent')
    })
  })

  describe('processTaskTemplate', () => {
    it('should process a string task directly', () => {
      // Setup mock data
      const mockTask: TaskConfig = {
        name: 'Simple Task',
        description: 'A simple task',
        agent: 'default-agent',
        task: 'This is a simple task',
      }

      // Call the method
      const result = taskManager.processTaskTemplate(mockTask, {})

      // Verify the result
      expect(result).toBe('This is a simple task')
    })

    it('should process a template task with parameters', () => {
      // Setup mock data
      const mockTask: TaskConfig = {
        name: 'Template Task',
        description: 'A template task',
        agent: 'default-agent',
        task: {
          template: 'Review the ${files.join("\\n- ")}',
          parameters: ['files'],
        },
      }

      // Call the method
      const result = taskManager.processTaskTemplate(mockTask, {
        files: ['file1.js', 'file2.js'],
      })

      // Verify the result
      expect(result).toBe('Review the file1.js\n- file2.js')
    })

    it('should handle missing parameters gracefully', () => {
      // Setup mock data
      const mockTask: TaskConfig = {
        name: 'Template Task',
        description: 'A template task',
        agent: 'default-agent',
        task: {
          template: 'Review the ${files ? files.join("\\n- ") : "no files provided"}',
          parameters: ['files'],
        },
      }

      // Call the method
      const result = taskManager.processTaskTemplate(mockTask, {})

      // Verify the result
      expect(result).toBe('Review the no files provided')
    })
  })
})
