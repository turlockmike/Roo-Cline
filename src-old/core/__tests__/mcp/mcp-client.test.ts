import { McpClient } from '../../mcp/mcp-client'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

jest.mock('@modelcontextprotocol/sdk/client/index.js')
jest.mock('@modelcontextprotocol/sdk/client/stdio.js')
jest.mock('fs/promises')
jest.mock('path')
jest.mock('os')

describe('McpClient', () => {
  let client: McpClient
  let mockSdkClient: jest.Mocked<Client>
  let mockTransport: jest.Mocked<StdioClientTransport>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock os.homedir
    ;(os.homedir as jest.Mock).mockReturnValue('/home/test')

    // Mock path.join
    ;(path.join as jest.Mock).mockImplementation((...parts) => parts.join('/'))

    // Mock fs operations
    ;(fs.readFile as jest.Mock).mockImplementation(async filePath => {
      if (filePath === '/test/config.json') {
        return JSON.stringify({
          mcpServers: {
            'test-server': {
              command: 'test',
              args: ['arg1'],
            },
          },
        })
      }
      throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
    })
    ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)

    // Mock SDK client
    mockSdkClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      request: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'Test Tool',
            inputSchema: { type: 'object' },
          },
        ],
      }),
    } as unknown as jest.Mocked<Client>
    ;(Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockSdkClient)

    // Mock transport
    mockTransport = {
      stderr: {
        on: jest.fn(),
      },
    } as unknown as jest.Mocked<StdioClientTransport>
    ;(StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(() => mockTransport)

    client = new McpClient()
  })

  describe('initialization', () => {
    it('loads existing config file', async () => {
      const mockConfig = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['arg1'],
          },
        },
      }

      ;(fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig))

      await client.initializeServers()

      expect(fs.readFile).toHaveBeenCalledWith('/home/test/.hataraku/mcp_settings.json', 'utf-8')
      expect(Client).toHaveBeenCalled()
      expect(StdioClientTransport).toHaveBeenCalled()
      expect(mockSdkClient.connect).toHaveBeenCalled()
    })

    it('creates default config if file does not exist', async () => {
      const error = new Error('File not found')
      ;(error as any).code = 'ENOENT'
      ;(fs.readFile as jest.Mock).mockRejectedValueOnce(error)

      await client.initializeServers()

      expect(fs.mkdir).toHaveBeenCalled()
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/home/test/.hataraku/mcp_settings.json',
        JSON.stringify({ mcpServers: {} }, null, 2),
      )
    })
  })

  describe('server tools', () => {
    beforeEach(async () => {
      await client.loadConfig({
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['arg1'],
          },
        },
      })
    })

    it('returns available servers', () => {
      const servers = client.getAvailableServers()
      expect(servers).toContain('test-server')
    })

    it('gets server tools', async () => {
      const result = await client.getServerTools('test-server')
      expect(result.serverName).toBe('test-server')
      expect(result.tools).toHaveLength(1)
      expect(result.tools[0].name).toBe('test-tool')
    })

    it('returns empty tools array for unknown server', async () => {
      const result = await client.getServerTools('unknown-server')
      expect(result.tools).toHaveLength(0)
    })
  })

  describe('tool execution', () => {
    beforeEach(async () => {
      await client.loadConfig({
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['arg1'],
          },
        },
      })
    })

    it('calls tool successfully', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: '{"result":"success"}' }],
        isError: false,
      }

      mockSdkClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.callTool('test-server', 'test-tool', { param: 'value' })
      expect(result.data).toEqual({ result: 'success' })
      expect(result.raw).toBe(mockResponse)
    })

    it('throws error for unknown server', async () => {
      await expect(client.callTool('unknown-server', 'test-tool', {})).rejects.toThrow(
        'Server "unknown-server" not found',
      )
    })

    it('throws error if servers not initialized', async () => {
      client = new McpClient()
      await expect(client.callTool('test-server', 'test-tool', {})).rejects.toThrow(
        'MCP servers have not been initialized',
      )
    })
  })
})
