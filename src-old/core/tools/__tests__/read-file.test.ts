import { Tool, ToolExecutionOptions } from 'ai'
import { readFileTool } from '../read-file'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('path')

describe('readFileTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = readFileTool as Required<Tool>

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>
  const mockPath = path as jest.Mocked<typeof path>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`)
  })

  it('should read file content successfully', async () => {
    const mockContent = 'line 1\nline 2\nline 3'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(mockContent)

    const result = await tool.execute(
      {
        path: 'test.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('1 | line 1\n2 | line 2\n3 | line 3')
    expect(mockFs.readFile).toHaveBeenCalledWith('/mock/path/test.txt', 'utf-8')
  })

  it('should handle empty files', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue('')

    const result = await tool.execute(
      {
        path: 'empty.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('')
  })

  it('should handle file not found', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'))

    const result = await tool.execute(
      {
        path: 'nonexistent.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('File not found at path: nonexistent.txt')
    expect(mockFs.readFile).not.toHaveBeenCalled()
  })

  it('should handle read errors', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockRejectedValue(new Error('Permission denied'))

    const result = await tool.execute(
      {
        path: 'protected.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error reading file: Permission denied')
  })

  it('should handle files with multiple empty lines', async () => {
    const mockContent = 'line 1\n\nline 3\n\nline 5'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(mockContent)

    const result = await tool.execute(
      {
        path: 'multiline.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('1 | line 1\n2 | \n3 | line 3\n4 | \n5 | line 5')
  })

  it('should handle files with trailing newlines', async () => {
    const mockContent = 'line 1\nline 2\n'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(mockContent)

    const result = await tool.execute(
      {
        path: 'trailing.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('1 | line 1\n2 | line 2\n3 | ')
  })

  it('should handle long file paths', async () => {
    const longPath = 'very/long/path/to/some/deeply/nested/file.txt'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue('content')

    await tool.execute(
      {
        path: longPath,
      },
      mockOptions,
    )

    expect(mockPath.resolve).toHaveBeenCalledWith(process.cwd(), longPath)
    expect(mockFs.readFile).toHaveBeenCalledWith(`/mock/path/${longPath}`, 'utf-8')
  })

  it('should handle non-string error messages', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockRejectedValue({ code: 'READ_ERROR' })

    const result = await tool.execute(
      {
        path: 'error.txt',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error reading file: [object Object]')
  })
})
