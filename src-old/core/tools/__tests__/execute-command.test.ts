import { Tool, ToolExecutionOptions } from 'ai'
import { createExecuteCommandTool } from '../execute-command'
import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { Readable } from 'stream'

// Mock child_process
jest.mock('child_process')

describe('executeCommandTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = createExecuteCommandTool() as Required<Tool>

  // Mock process setup helper
  function setupMockProcess(options: {
    stdout?: string[]
    stderr?: string[]
    exitCode?: number
    error?: Error
  }): ChildProcess {
    const mockStdout = new EventEmitter() as Readable
    const mockStderr = new EventEmitter() as Readable
    const mockProcess = new EventEmitter() as ChildProcess

    // Add required stream properties
    mockStdout.pipe = jest.fn().mockReturnValue(mockStdout)
    mockStderr.pipe = jest.fn().mockReturnValue(mockStderr)

    // Attach streams to process
    Object.defineProperty(mockProcess, 'stdout', {
      value: mockStdout,
      writable: true,
    })
    Object.defineProperty(mockProcess, 'stderr', {
      value: mockStderr,
      writable: true,
    })

    // Mock spawn implementation
    ;(spawn as jest.Mock).mockImplementation(() => {
      // Schedule stdout emissions
      if (options.stdout) {
        options.stdout.forEach(data => {
          setImmediate(() => mockStdout.emit('data', Buffer.from(data)))
        })
      }

      // Schedule stderr emissions
      if (options.stderr) {
        options.stderr.forEach(data => {
          setImmediate(() => mockStderr.emit('data', Buffer.from(data)))
        })
      }

      // Schedule process completion or error
      setImmediate(() => {
        if (options.error) {
          mockProcess.emit('error', options.error)
        } else {
          mockProcess.emit('close', options.exitCode ?? 0)
        }
      })

      return mockProcess
    })

    return mockProcess
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should successfully execute a command', async () => {
    setupMockProcess({
      stdout: ['Command output'],
      exitCode: 0,
    })

    const result = await tool.execute(
      {
        command: 'echo "test"',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Command output')
    expect(spawn).toHaveBeenCalledWith('echo "test"', [], expect.any(Object))
  })

  it('should handle command with no output', async () => {
    setupMockProcess({
      stdout: [],
      exitCode: 0,
    })

    const result = await tool.execute(
      {
        command: 'touch file.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Command completed successfully with no output')
  })

  it('should handle command errors', async () => {
    setupMockProcess({
      stderr: ['Command failed'],
      exitCode: 1,
    })

    const result = await tool.execute(
      {
        command: 'invalid-command',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Command failed')
  })

  it('should handle process spawn errors', async () => {
    setupMockProcess({
      error: new Error('Failed to spawn process'),
    })

    const result = await tool.execute(
      {
        command: 'some-command',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Failed to execute command: Failed to spawn process')
  })

  it('should handle mixed stdout and stderr output', async () => {
    setupMockProcess({
      stdout: ['Standard output'],
      stderr: ['Error output'],
      exitCode: 0,
    })

    const result = await tool.execute(
      {
        command: 'mixed-output-command',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('Standard output')
    expect(console.error).toHaveBeenCalledWith('Error output')
  })

  it('should handle non-zero exit codes', async () => {
    setupMockProcess({
      stderr: [],
      exitCode: 2,
    })

    const result = await tool.execute(
      {
        command: 'failing-command',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Command failed with code 2')
  })

  it('should log output in real-time', async () => {
    setupMockProcess({
      stdout: ['First line\n', 'Second line'],
      exitCode: 0,
    })

    await tool.execute(
      {
        command: 'multi-line-command',
      },
      mockOptions,
    )

    expect(console.log).toHaveBeenCalledWith('First line\n')
    expect(console.log).toHaveBeenCalledWith('Second line')
  })
})
