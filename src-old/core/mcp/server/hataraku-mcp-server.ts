import { Server } from '@modelcontextprotocol/sdk/server/index.js'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { Task } from '../../task'
import { TaskToolAdapter } from './task-tool-adapter'
import { Agent, createAgent } from '../../agent'
import { LanguageModelV1 } from 'ai'
import {
  createCodeAnalysisTask,
  createBugAnalysisTask,
  createPRReviewTask,
  createRefactoringPlanTask,
} from '../../sample-tasks'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

interface ServerResult {
  tools?: Array<{
    name: string
    description?: string
    inputSchema: {
      type: 'object'
      properties?: Record<string, unknown>
    }
  }>
  content?: Array<{
    type: string
    text: string
  }>
  _meta?: Record<string, unknown>
  nextCursor?: string
}

// Should be stored in ~/.hataraku/hataraku-mcp-server-<timestamp>.log
const logDir = path.join(os.homedir(), '.hataraku')
// Create the log directory if it doesn't exist
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true })
}
const logFile = path.join(logDir, `hataraku-mcp-server-${Date.now()}.log`)
function log(message: string) {
  appendFileSync(logFile, message)
}

export class HatarakuMcpServer {
  private server: Server
  private tasks: Map<string, Task<any, any>>
  private adapter: TaskToolAdapter
  private agent: Agent

  constructor(model: LanguageModelV1, defaultAgent?: Agent) {
    this.server = new Server(
      {
        name: 'hataraku-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.server.onerror = (error: McpError) => {
      console.error(`Server error: ${error.message}`, { code: error.code, stack: error.stack })
    }
    this.tasks = new Map()
    this.adapter = new TaskToolAdapter()

    this.agent =
      defaultAgent ??
      createAgent({
        name: 'hataraku-task-agent',
        description: 'Agent for executing Hataraku tasks',
        role: 'A software development assistant that helps with code analysis, review, and improvement',
        model,
      })
  }

  async start(transport: Transport = new StdioServerTransport()) {
    await this.discoverTasks()
    await this.registerTools()

    await this.server.connect(transport)
    return this.server
  }

  private async discoverTasks(): Promise<void> {
    // Create instances of all available tasks
    const taskFactories = [createCodeAnalysisTask, createBugAnalysisTask, createPRReviewTask, createRefactoringPlanTask]

    // Initialize tasks with the default agent
    for (const factory of taskFactories) {
      const task = factory(this.agent)
      this.tasks.set(task.name, task)
    }
  }

  private async registerTools(): Promise<void> {
    // Register tasks as MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tasks.values()).map(task => {
        const tool = this.adapter.convertToMcpTool(task)
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object' as const,
            properties: {
              content: {
                type: 'string',
                description: 'The input content for the task',
              },
            },
            required: ['content'],
          },
        }
      })

      return {
        tools,
        _meta: {},
      } satisfies ServerResult
    })

    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const task = this.tasks.get(request.params.name)
      if (!task) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`)
      }

      try {
        const logEntry = `Calling task: ${task.name}\nRequest params: ${JSON.stringify(request.params)}\n`
        log(logEntry)

        const args = request.params.arguments || {}
        if (!args.content || typeof args.content !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid content parameter')
        }

        const tool = this.adapter.convertToMcpTool(task)
        const result = await tool.execute({ content: args.content })

        log(`Task ${task.name} executed with result: ${JSON.stringify(result)}`)
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
          _meta: {},
        } satisfies ServerResult
      } catch (error) {
        console.error('Task execution error:', error)
        if (error instanceof McpError) {
          throw error
        }
        throw new McpError(ErrorCode.InvalidRequest, error instanceof Error ? error.message : 'Task execution failed')
      }
    })
  }

  async close() {
    await this.server.close()
  }
}
