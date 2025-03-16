import { Tool, ToolExecutionOptions } from 'ai'
import { listCodeDefinitionsTool } from '../list-code-definitions'
import * as path from 'path'
import { parseSourceCodeForDefinitionsTopLevel } from '../../../services/tree-sitter'

// Mock dependencies
jest.mock('path')
jest.mock('../../../services/tree-sitter')

describe('listCodeDefinitionsTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: [],
  }

  // Cast tool to ensure execute method is available
  const tool = listCodeDefinitionsTool as Required<Tool>

  // Mock implementations
  const mockPath = path as jest.Mocked<typeof path>
  const mockTreeSitter = parseSourceCodeForDefinitionsTopLevel as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`)
  })

  it('should list code definitions successfully', async () => {
    const mockDefinitions = `
Functions:
- calculateTotal(items)
- processData(input)

Classes:
- DataProcessor
  - constructor(config)
  - process(data)
  - validate()

Interfaces:
- IDataConfig
- IProcessResult
`

    mockTreeSitter.mockResolvedValue(mockDefinitions)

    const result = await tool.execute(
      {
        path: 'src/code',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(mockDefinitions)
    expect(mockPath.resolve).toHaveBeenCalledWith(process.cwd(), 'src/code')
    expect(mockTreeSitter).toHaveBeenCalledWith('/mock/path/src/code')
  })

  it('should handle empty definitions', async () => {
    mockTreeSitter.mockResolvedValue('')

    const result = await tool.execute(
      {
        path: 'src/empty',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('No code definitions found in src/empty')
  })

  it('should handle whitespace-only definitions', async () => {
    mockTreeSitter.mockResolvedValue('   \n  \t  ')

    const result = await tool.execute(
      {
        path: 'src/whitespace',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe('No code definitions found in src/whitespace')
  })

  it('should handle parsing errors', async () => {
    const errorMessage = 'Failed to parse source code'
    mockTreeSitter.mockRejectedValue(new Error(errorMessage))

    const result = await tool.execute(
      {
        path: 'src/error',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe(`Error listing code definitions: ${errorMessage}`)
  })

  it('should handle complex code definitions', async () => {
    const mockDefinitions = `
Classes:
- UserService
  - constructor(database)
  - async findById(id)
  - async create(userData)
  - async update(id, changes)
  - async delete(id)

Interfaces:
- IUser
- IUserCreate
- IUserUpdate

Types:
- UserRole = 'admin' | 'user' | 'guest'
- ValidationResult = { valid: boolean, errors?: string[] }

Functions:
- validateUser(data)
- hashPassword(plain)
- comparePasswords(plain, hashed)

Constants:
- DEFAULT_USER_ROLE
- PASSWORD_REGEX
`

    mockTreeSitter.mockResolvedValue(mockDefinitions)

    const result = await tool.execute(
      {
        path: 'src/users',
      },
      mockOptions,
    )

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(mockDefinitions)
  })

  it('should handle non-string error messages', async () => {
    mockTreeSitter.mockRejectedValue({ code: 'PARSE_ERROR' })

    const result = await tool.execute(
      {
        path: 'src/error',
      },
      mockOptions,
    )

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error listing code definitions: [object Object]')
  })
})
