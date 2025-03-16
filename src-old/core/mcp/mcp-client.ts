import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import chalk from 'chalk'
import { McpConfig } from './config'
import { McpToolResponse, ParsedMcpToolResponse } from './types'

interface McpConnection {
  name: string
  client: Client
  transport: StdioClientTransport
  status: 'connecting' | 'connected' | 'disconnected'
  error?: string
}

export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, any>
}

export interface McpServerTools {
  serverName: string
  tools: McpTool[]
}

export class McpClient {
  private connections: Map<string, McpConnection> = new Map()
  private initialized: boolean = false
  private defaultConfigPath: string

  constructor() {
    this.defaultConfigPath = path.join(os.homedir(), '.hataraku', 'mcp_settings.json')
    // Bind methods to ensure correct 'this' context
    this.disconnectServer = this.disconnectServer.bind(this)
    this.connectToServer = this.connectToServer.bind(this)
    this.getServerTools = this.getServerTools.bind(this)
    this.callTool = this.callTool.bind(this)
  }

  /**
   * Initialize MCP servers using the default config path
   */
  async initializeServers(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const configContent = await fs.readFile(this.defaultConfigPath, 'utf-8')
      const config = JSON.parse(configContent)
      await this.loadConfig(config)
    } catch (error: any) {
      // If file doesn't exist, create it with empty config
      if (error.code === 'ENOENT') {
        const defaultConfig: McpConfig = { mcpServers: {} }
        await fs.mkdir(path.dirname(this.defaultConfigPath), { recursive: true })
        await fs.writeFile(this.defaultConfigPath, JSON.stringify(defaultConfig, null, 2))
        await this.loadConfig(defaultConfig)
      } else {
        throw error
      }
    }

    this.initialized = true
  }

  /**
   * Load configuration from a specific config object
   */
  async loadConfig(config: McpConfig): Promise<void> {
    // Disconnect existing connections
    for (const connection of this.connections.values()) {
      await this.disconnectServer(connection.name)
    }

    // Connect to new servers
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      await this.connectToServer(name, serverConfig)
    }

    this.initialized = true
  }

  /**
   * Load configuration from a specific file path
   */
  async loadConfigFromPath(configPath: string): Promise<void> {
    const configContent = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(configContent)
    await this.loadConfig(config)
  }

  private async connectToServer(name: string, config: McpConfig['mcpServers'][string]): Promise<void> {
    // Remove existing connection if it exists
    await this.disconnectServer(name)

    try {
      const client = new Client(
        {
          name: 'Hataraku',
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      )

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: {
          ...config.env,
          ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
        },
        stderr: 'pipe',
      })

      const connection: McpConnection = {
        name,
        client,
        transport,
        status: 'connecting',
      }

      // Set up stderr handling
      const stderrStream = transport.stderr
      if (stderrStream) {
        stderrStream.on('data', (data: Buffer) => {
          const errorOutput = data.toString()
          if (connection.error) {
            connection.error += '\n' + errorOutput
          } else {
            connection.error = errorOutput
          }
        })
      }

      // Connect to the server
      await client.connect(transport)
      connection.status = 'connected'
      connection.error = undefined

      this.connections.set(name, connection)
    } catch (error) {
      const connection = this.connections.get(name)
      if (connection) {
        connection.status = 'disconnected'
        connection.error = error instanceof Error ? error.message : String(error)
      }
      throw error
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(name: string): Promise<void> {
    const connection = this.connections.get(name)
    if (connection) {
      try {
        await connection.client.close()
      } catch (error) {
        console.error(chalk.red(`Error disconnecting from server ${name}:`, error))
      }
      this.connections.delete(name)
    }
  }

  /**
   * Get list of available server names
   */
  getAvailableServers(): string[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected')
      .map(conn => conn.name)
  }

  /**
   * Get tools for a specific server
   */
  async getServerTools(serverName: string): Promise<McpServerTools> {
    const connection = this.connections.get(serverName)
    if (!connection || connection.status !== 'connected') {
      return { serverName, tools: [] }
    }

    try {
      const response = await connection.client.request({ method: 'tools/list' }, ListToolsResultSchema)

      return {
        serverName,
        tools:
          response?.tools?.map(tool => ({
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema,
          })) || [],
      }
    } catch (error) {
      console.error(chalk.red(`Error fetching tools from server ${serverName}:`, error))
      return { serverName, tools: [] }
    }
  }

  /**
   * Call a tool on a specific server and parse its response
   */
  async callTool<T = string>(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ParsedMcpToolResponse<T>> {
    if (!this.initialized) {
      throw new Error('MCP servers have not been initialized')
    }

    const connection = this.connections.get(serverName)
    if (!connection) {
      throw new Error(`Server "${serverName}" not found`)
    }

    if (connection.status !== 'connected') {
      throw new Error(`Server "${serverName}" is not connected (status: ${connection.status})`)
    }

    const response = (await connection.client.request(
      {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      },
      CallToolResultSchema,
    )) as McpToolResponse

    if (response.isError) {
      throw new Error(`Tool ${serverName}/${toolName} returned an error`)
    }

    // Parse the response content
    const content = response.content[0]?.text
    if (!content) {
      throw new Error(`Tool ${serverName}/${toolName} returned no content`)
    }

    try {
      const data = JSON.parse(content)
      return {
        data,
        raw: response,
      }
    } catch (error) {
      // If the content is not JSON, return the content as a string
      return {
        data: content as T,
        raw: response,
      }
    }
  }
}
