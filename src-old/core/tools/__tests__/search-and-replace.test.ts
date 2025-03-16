import { Tool, ToolExecutionOptions } from 'ai'
import { searchAndReplaceTool } from '../search-and-replace'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('path')

describe('searchAndReplaceTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = searchAndReplaceTool as Required<Tool>

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>
  const mockPath = path as jest.Mocked<typeof path>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`)
  })

  it('should perform simple text replacement', async () => {
    const originalContent = 'Hello world\nGoodbye world'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'world',
            replace: 'universe',
            use_regex: false,
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'Hello universe\nGoodbye universe', 'utf-8')
  })

  it('should handle regex replacement', async () => {
    const originalContent = 'test123\ntest456\ntest789'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'test\\d+',
            replace: 'number',
            use_regex: true,
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'number\nnumber\nnumber', 'utf-8')
  })

  it('should handle line range replacement', async () => {
    const originalContent = 'line1\nline2\nline3\nline4'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'line',
            replace: 'row',
            start_line: 2,
            end_line: 3,
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'line1\nrow2\nrow3\nline4', 'utf-8')
  })

  it('should handle case-insensitive replacement', async () => {
    const originalContent = 'TEST\nTest\ntest'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'test',
            replace: 'example',
            ignore_case: true,
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'example\nexample\nexample', 'utf-8')
  })

  it('should handle multiple operations in sequence', async () => {
    const originalContent = 'Hello world\nHi world'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'Hello',
            replace: 'Hi',
          },
          {
            search: 'world',
            replace: 'universe',
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'Hi universe\nHi universe', 'utf-8')
  })

  it('should handle file not found', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'))

    const result = await tool.execute(
      {
        path: 'nonexistent.txt',
        operations: [
          {
            search: 'test',
            replace: 'example',
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('File not found at path: nonexistent.txt')
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should handle invalid regex patterns', async () => {
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue('test content')

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: '[invalid regex',
            replace: 'replacement',
            use_regex: true,
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/Error performing search and replace/)
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should handle no changes needed', async () => {
    const content = 'test content'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(content)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'nonexistent',
            replace: 'replacement',
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe("No changes needed for 'test.txt'")
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should handle custom regex flags', async () => {
    const originalContent = 'test\nTEST\nTest'
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readFile.mockResolvedValue(originalContent)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await tool.execute(
      {
        path: 'test.txt',
        operations: [
          {
            search: 'test',
            replace: 'example',
            regex_flags: 'gi',
          },
        ],
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(mockFs.writeFile).toHaveBeenCalledWith('/mock/path/test.txt', 'example\nexample\nexample', 'utf-8')
  })
})
