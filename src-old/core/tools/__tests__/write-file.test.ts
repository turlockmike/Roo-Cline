import { Tool, ToolExecutionOptions } from 'ai'
import { writeFileTool } from '../write-file'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('path')

describe('writeFileTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = writeFileTool as Required<Tool>

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>
  const mockPath = path as jest.Mocked<typeof path>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`)
    mockPath.dirname.mockImplementation(filePath => {
      const parts = filePath.split('/')
      parts.pop()
      return parts.join('/')
    })
  })

  it('should write file content successfully', async () => {
    const content = 'test content\nline 2'
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        content,
        line_count: 2,
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('File successfully updated at test.txt')
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', content, 'utf-8')
  })

  it('should create directories if they do not exist', async () => {
    const content = 'test content'
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockRejectedValue(new Error('File not found'))

    const result = await tool.execute(
      {
        path: 'nested/dir/test.txt',
        content,
        line_count: 1,
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('File successfully created at nested/dir/test.txt')
    expect(mockFs.mkdir).toHaveBeenCalledWith('/mock/path/nested/dir', { recursive: true })
  })

  it('should validate line count matches content', async () => {
    const content = 'single line'

    const result = await tool.execute(
      {
        path: 'test.txt',
        content,
        line_count: 2, // Incorrect line count
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(
      'Content appears to be truncated or contains omission indicators. File has 1 lines but was predicted to have 2 lines. Please provide complete file content without omissions.',
    )
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should handle write errors', async () => {
    const content = 'test content'
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockRejectedValue(new Error('Permission denied'))

    const result = await tool.execute(
      {
        path: 'test.txt',
        content,
        line_count: 1,
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error writing file: Permission denied')
  })

  it('should handle directory creation errors', async () => {
    const content = 'test content'
    mockFs.mkdir.mockRejectedValue(new Error('Cannot create directory'))

    const result = await tool.execute(
      {
        path: 'nested/test.txt',
        content,
        line_count: 1,
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error writing file: Cannot create directory')
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should handle empty content', async () => {
    const content = ''
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'empty.txt',
        content,
        line_count: 0,
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('File successfully updated at empty.txt')
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/empty.txt', '', 'utf-8')
  })

  it('should handle content with trailing newlines', async () => {
    const content = 'line 1\nline 2\n'
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        content,
        line_count: 3, // Including empty line from trailing newline
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('File successfully updated at test.txt')
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', content, 'utf-8')
  })

  it('should handle non-string error messages', async () => {
    const content = 'test content'
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockRejectedValue({ code: 'WRITE_ERROR' })

    const result = await tool.execute(
      {
        path: 'test.txt',
        content,
        line_count: 1,
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error writing file: [object Object]')
  })
})
