import { LanguageModelV1, generateText, generateObject, streamText, ToolSet, CoreMessage, Message } from 'ai'
import { z } from 'zod'
import { AsyncIterableStream } from './types'
import { Thread } from './thread/thread'
import { TaskHistory, HistoryEntry } from './task-history'
import { v4 as uuid } from 'uuid'
import { colors, log } from '../utils/colors'
const DEFAULT_MAX_STEPS = 25
const DEFAULT_MAX_RETRIES = 4

interface CallSettings {
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  presencePenalty?: number
  frequencyPenalty?: number
  stopSequences?: string[]
  seed?: number
  maxRetries?: number
  abortSignal?: AbortSignal
  headers?: Record<string, string | undefined>
  maxSteps?: number
  toolChoice?: 'auto' | 'none' | 'required'
}

/**
 * Configuration options for creating an Agent.
 * @interface AgentConfig
 */
export interface AgentConfig {
  /** The name of the agent */
  name: string
  /** A description of what the agent does */
  description: string
  /** System instructions for the agent that define its behavior and capabilities */
  role: string
  /** The language model to use for the agent, can be provided directly or as a Promise */
  model?: LanguageModelV1 | Promise<LanguageModelV1>
  /** Optional set of tools the agent can use to perform tasks */
  tools?: ToolSet
  /** Optional settings to customize model API calls */
  callSettings?: CallSettings
  /** Optional task history manager to track agent interactions */
  taskHistory?: TaskHistory
  /** Whether to enable verbose logging of agent operations */
  verbose?: boolean
  /** Whether to enable prompt caching (defaults to true) */
  enableCaching?: boolean
}

/**
 * Input parameters for an agent task.
 * @interface TaskInput
 * @template T - The expected return type when using a schema
 */
export interface TaskInput<T = unknown> {
  /** Optional thread containing message history for context */
  thread?: Thread
  /** Optional Zod schema to validate and structure the response */
  schema?: z.ZodType<T>
  /** Whether to stream the response as it's generated */
  stream?: boolean
  /** Whether to enable verbose logging for this specific task */
  verbose?: boolean
  /** Whether to use the model provided in the agent config */
  model?: LanguageModelV1
}

/**
 * Result of a streaming task execution.
 * @interface StreamingTaskResult
 */
export interface StreamingTaskResult {
  /** An async generator that yields chunks of the response as they become available */
  stream: AsyncGenerator<string>
}

/**
 * Agent class that can execute tasks using a language model.
 * The agent can use tools, maintain conversation history, and generate structured responses.
 */
export class Agent {
  /** The name of the agent */
  public readonly name: string
  /** A description of what the agent does */
  public readonly description: string
  /** Promise that resolves to the language model used by the agent */
  private readonly modelPromise?: Promise<LanguageModelV1>
  /** Set of tools the agent can use to perform tasks */
  public readonly tools: ToolSet
  /** Settings to customize model API calls */
  public readonly callSettings: CallSettings
  /** System instructions that define the agent's behavior and capabilities */
  public readonly role: string
  /** Optional task history manager to track agent interactions */
  private readonly taskHistory?: TaskHistory
  /** Whether to enable verbose logging of agent operations */
  private readonly verbose: boolean
  /** Whether to enable prompt caching */
  private readonly enableCaching: boolean

  constructor(config: AgentConfig) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name cannot be empty')
    }
    this.name = config.name
    this.description = config.description
    this.modelPromise = config.model
      ? config.model instanceof Promise
        ? config.model
        : Promise.resolve(config.model)
      : undefined
    this.tools = config.tools || {}
    this.callSettings = config.callSettings || {}
    this.role = config.role
    this.taskHistory = config.taskHistory
    this.verbose = config.verbose || false
    this.enableCaching = config.enableCaching ?? true // Enable caching by default
  }

  /**
   * Gets the system prompt content for the agent
   * @returns The system prompt content
   */
  private getSystemPrompt() {
    return `
    ROLE:
    ${this.role}

    DESCRIPTION given to the user:
    ${this.description}
    `
  }

  /**
   * Detects the provider from the model name
   * @param model The language model
   * @returns The provider name or undefined if not detected
   */
  private detectProvider(model: LanguageModelV1): string | undefined {
    const modelName = model.constructor.name.toLowerCase()

    if (modelName.includes('anthropic')) {
      return 'anthropic'
    } else if (modelName.includes('openai')) {
      return 'openai'
    } else if (modelName.includes('bedrock')) {
      return 'bedrock'
    } else if (modelName.includes('vertex')) {
      return 'vertex'
    } else if (modelName.includes('openrouter')) {
      return 'openrouter'
    }

    return undefined
  }

  /**
   * Execute a task with the agent.
   * @param task - The task to execute.
   * @param input - The input to the task.
   * @returns The response from the task.
   */
  async task(task: string, input?: TaskInput & { stream: false | undefined }): Promise<string>
  async task(task: string, input?: TaskInput & { stream: true }): Promise<AsyncIterableStream<string>>
  async task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T> }): Promise<T>
  async task(task: string, input?: TaskInput): Promise<string>
  async task<T>(
    task: string,
    input?: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T> },
  ): Promise<string | AsyncIterableStream<string> | T> {
    const model = input?.model || (this.modelPromise ? await this.modelPromise : undefined)
    if (!model) {
      throw new Error('No model provided')
    }
    const thread = input?.thread || new Thread()
    const maxSteps = this.callSettings.maxSteps || DEFAULT_MAX_STEPS
    const maxRetries = this.callSettings.maxRetries || DEFAULT_MAX_RETRIES

    // Add system message if the thread doesn't have one
    if (!thread.hasSystemMessage()) {
      thread.addSystemMessage(this.getSystemPrompt())
    }

    // Detect provider and add cache control point to system message
    const provider = this.detectProvider(model)
    if (provider && this.enableCaching) {
      thread.addCacheControlPointToSystemMessage(provider)
    }

    thread.addMessage('user', task)

    // Use verbose mode if specified in input or agent config
    const isVerbose = input?.verbose !== undefined ? input.verbose : this.verbose

    if (isVerbose) {
      log.system('\n🔍 Task details:')
      log.system(`Task: ${task}`)
      log.system(`Max steps: ${maxSteps}, Max retries: ${maxRetries}`)
      log.system(`Stream: ${input?.stream ? 'enabled' : 'disabled'}`)
      log.system('Thread history:')
      for (const msg of thread.getMessages()) {
        log.system(`- ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`)
      }
    }

    // Create history entry
    const taskId = uuid()
    const historyEntry: HistoryEntry = {
      taskId,
      timestamp: Date.now(),
      task,
      tokensIn: 0,
      tokensOut: 0,
      cacheWrites: 0,
      cacheReads: 0,
      totalCost: 0,
      model: model.constructor.name,
      messages: thread
        .getMessages()
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      debug: {
        requests: [
          {
            timestamp: Date.now(),
            systemPrompt: this.getSystemPrompt(),
            messages: thread
              .getFormattedMessages()
              .filter(msg => msg.role === 'user' || msg.role === 'assistant')
              .map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: Array.isArray(msg.content)
                  ? msg.content.map(part => ('text' in part ? part.text : '')).join('')
                  : msg.content,
              })),
          },
        ],
        responses: [],
        toolUsage: [],
      },
    }

    if (input?.stream) {
      if (isVerbose) {
        log.system('\n🔄 Starting streaming text generation...')
      }
      try {
        const { textStream } = streamText({
          model,
          messages: thread.getFormattedMessages(),
          maxSteps,
          maxRetries,
          tools: this.tools,
          ...this.callSettings,
          onChunk: event => {
            if (isVerbose) {
              const chunk = event.chunk
              if (chunk.type === 'text-delta' || chunk.type === 'reasoning') {
                log.system(chunk.textDelta)
              } else {
                log.system(JSON.stringify(chunk))
              }
            }
          },
          onStepFinish: step => {
            if (isVerbose) {
              log.system(`\n📝 Step finished:`)
              if (step.reasoning) {
                log.system(
                  `<thinking> ${step.reasoning?.substring(0, 100)}${
                    step.reasoning?.length > 100 ? '...' : ''
                  }</thinking>`,
                )
              }
              log.system(`<response> ${step.text}</response>`)

              // Log tool calls if any
              if (step.toolCalls && step.toolCalls.length > 0) {
                log.system(`\n🔧 Tool calls in this step: ${step.toolCalls.length}`)
                for (let i = 0; i < step.toolCalls.length; i++) {
                  const toolCall = step.toolCalls[i]
                  log.system(`Tool call #${i + 1}: ${JSON.stringify(toolCall).substring(0, 150)}...`)
                }
              }
            }
          },
          onError: error => {
            if (isVerbose) {
              log.system(`\n❌ Error streaming text: ${error instanceof Error ? error.message : String(error)}`)
            }
            console.error('Error streaming text', error)
            if (this.taskHistory && historyEntry.debug) {
              historyEntry.debug.responses.push({
                timestamp: Date.now(),
                content: error instanceof Error ? error.message : String(error),
                usage: {
                  tokensIn: 0,
                  tokensOut: 0,
                  // cost: 0
                },
              })
              // Add to tool usage for error tracking
              historyEntry.debug.toolUsage.push({
                timestamp: Date.now(),
                tool: 'stream',
                params: {},
                result: error instanceof Error ? error.message : String(error),
                error: true,
              })
              this.taskHistory.saveTask(historyEntry).catch(console.error)
            }
          },
          onFinish: result => {
            if (isVerbose) {
              log.system(
                `\n✅ Streaming completed: ${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}`,
              )
              log.system(`Tokens: In=${result.usage?.promptTokens || 0}, Out=${result.usage?.completionTokens || 0}`)
            }
            thread.addMessage('assistant', result.text, {
              usage: {
                tokensIn: result.usage?.promptTokens || 0,
                tokensOut: result.usage?.completionTokens || 0,
                // providerMetadata: result.providerMetadata
              },
            })
            if (this.taskHistory && historyEntry.debug) {
              historyEntry.debug.responses.push({
                timestamp: Date.now(),
                content: result.text,
                usage: {
                  tokensIn: result.usage?.promptTokens || 0,
                  tokensOut: result.usage?.completionTokens || 0,
                },
              })
              historyEntry.tokensIn += result.usage?.promptTokens || 0
              historyEntry.tokensOut += result.usage?.completionTokens || 0
              this.taskHistory.saveTask(historyEntry).catch(console.error)
            }

            // Add cache control point to the last message
            if (provider && this.enableCaching) {
              thread.addCacheControlPointToLastMessage(provider)
            }
          },
        })

        return textStream
      } catch (error) {
        console.error('Error streaming text', error)
        throw error
      }
    }

    try {
      let result
      if (Object.keys(this.tools).length > 0 && input?.schema) {
        if (isVerbose) {
          log.system('\n🔄 Starting text generation with tools and schema...')
          log.system(JSON.stringify(this.tools))
        }

        result = await generateText({
          model,
          messages: thread.getFormattedMessages(),
          maxSteps,
          maxRetries,
          onStepFinish: step => {
            if (isVerbose) {
              log.system(`\n📝 Step finished:`)
              log.system(
                `Reasoning: ${step.reasoning?.substring(0, 100)}${
                  step.reasoning && step.reasoning.length > 100 ? '...' : ''
                }`,
              )
              log.system(`Text: ${step.text.substring(0, 100)}${step.text.length > 100 ? '...' : ''}`)

              // Log tool calls if any
              if (step.toolCalls && step.toolCalls.length > 0) {
                log.system(`\n🔧 Tool calls in this step: ${step.toolCalls.length}`)
                for (let i = 0; i < step.toolCalls.length; i++) {
                  const toolCall = step.toolCalls[i]
                  log.system(`Tool call #${i + 1}: ${JSON.stringify(toolCall).substring(0, 150)}...`)
                }
              }
            }
          },
          tools: this.tools,
          ...this.callSettings,
        })

        if (isVerbose) {
          log.system(
            `\n✅ Text generation completed: ${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}`,
          )
          log.system(`Tokens: In=${result.usage?.promptTokens || 0}, Out=${result.usage?.completionTokens || 0}`)
        }

        thread.addMessage('assistant', result.text, {
          usage: {
            tokensIn: result.usage?.promptTokens || 0,
            tokensOut: result.usage?.completionTokens || 0,
            // providerMetadata: result.providerMetadata
          },
        })

        // Add cache control point to the assistant message
        if (provider && this.enableCaching) {
          thread.addCacheControlPointToLastMessage(provider)
        }

        thread.addMessage(
          'user',
          'Based on the last response, please create a response that matches the schema provided. It must be valid JSON and match the schema exactly.',
        )

        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: result.text,
            usage: {
              tokensIn: result.usage?.promptTokens || 0,
              tokensOut: result.usage?.completionTokens || 0,
              // providerMetadata: result.providerMetadata
            },
          })
          historyEntry.tokensIn += result.usage?.promptTokens || 0
          historyEntry.tokensOut += result.usage?.completionTokens || 0
        }

        if (isVerbose) {
          log.system('\n🔄 Starting object generation with schema...')
        }

        const { object } = await generateObject({
          model,
          messages: thread.getFormattedMessages(),
          maxRetries,
          maxSteps,
          schema: input.schema,
          ...this.callSettings,
        })

        if (isVerbose) {
          log.system(
            `\n✅ Object generation completed: ${JSON.stringify(object).substring(0, 50)}${
              JSON.stringify(object).length > 50 ? '...' : ''
            }`,
          )
        }

        thread.addMessage('assistant', JSON.stringify(object), {
          usage: {
            tokensIn: result.usage?.promptTokens || 0,
            tokensOut: result.usage?.completionTokens || 0,
            // providerMetadata: result.providerMetadata
          },
        })

        // Add cache control point to the last message
        if (provider && this.enableCaching) {
          thread.addCacheControlPointToLastMessage(provider)
        }

        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: JSON.stringify(object),
            usage: {
              tokensIn: result.usage?.promptTokens || 0,
              tokensOut: result.usage?.completionTokens || 0,
              providerMetadata: result.providerMetadata,
            },
          })
          this.taskHistory.saveTask(historyEntry).catch(console.error)
        }

        return object
      }

      if (input?.schema) {
        if (isVerbose) {
          log.system('\n🔄 Starting object generation with schema...')
        }

        const result = await generateObject({
          model,
          messages: thread.getFormattedMessages(),
          maxRetries,
          maxSteps,
          schema: input.schema,
          ...this.callSettings,
        })

        if (isVerbose) {
          log.system(
            `\n✅ Object generation completed: ${JSON.stringify(result.object).substring(0, 50)}${
              JSON.stringify(result.object).length > 50 ? '...' : ''
            }`,
          )
          log.system(`Tokens: In=${result.usage?.promptTokens || 0}, Out=${result.usage?.completionTokens || 0}`)
        }

        thread.addMessage('assistant', JSON.stringify(result.object), {
          usage: {
            tokensIn: result.usage?.promptTokens || 0,
            tokensOut: result.usage?.completionTokens || 0,
            // providerMetadata: result.providerMetadata
          },
        })

        // Add cache control point to the last message
        if (provider && this.enableCaching) {
          thread.addCacheControlPointToLastMessage(provider)
        }

        if (this.taskHistory && historyEntry.debug) {
          historyEntry.debug.responses.push({
            timestamp: Date.now(),
            content: JSON.stringify(result.object),
            usage: {
              tokensIn: result.usage?.promptTokens || 0,
              tokensOut: result.usage?.completionTokens || 0,
              providerMetadata: result.providerMetadata,
            },
          })
          historyEntry.tokensIn += result.usage?.promptTokens || 0
          historyEntry.tokensOut += result.usage?.completionTokens || 0
          this.taskHistory.saveTask(historyEntry).catch(console.error)
        }

        return result.object
      }

      if (isVerbose) {
        log.system('\n🔄 Starting text generation...')
      }

      result = await generateText({
        model,
        messages: thread.getFormattedMessages(),
        maxSteps,
        maxRetries,
        onStepFinish: step => {
          if (isVerbose) {
            log.system(`\n📝 Step finished:`)
            log.system(
              `Reasoning: ${step.reasoning?.substring(0, 100)}${
                step.reasoning && step.reasoning.length > 100 ? '...' : ''
              }`,
            )
            log.system(`Text: ${step.text.substring(0, 100)}${step.text.length > 100 ? '...' : ''}`)

            // Log tool calls if any
            if (step.toolCalls && step.toolCalls.length > 0) {
              log.system(`\n🔧 Tool calls in this step: ${step.toolCalls.length}`)
              for (let i = 0; i < step.toolCalls.length; i++) {
                const toolCall = step.toolCalls[i]
                log.system(`Tool call #${i + 1}: ${JSON.stringify(toolCall).substring(0, 150)}...`)
              }
            }
          }
        },
        tools: this.tools,
        ...this.callSettings,
      })

      if (isVerbose) {
        log.system(
          `\n✅ Text generation completed: ${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}`,
        )
        log.system(`Tokens: In=${result.usage?.promptTokens || 0}, Out=${result.usage?.completionTokens || 0}`)
      }

      thread.addMessage('assistant', result.text, {
        usage: {
          tokensIn: result.usage?.promptTokens || 0,
          tokensOut: result.usage?.completionTokens || 0,
          // providerMetadata: result.providerMetadata
        },
      })

      // Add cache control point to the last message
      if (provider && this.enableCaching) {
        thread.addCacheControlPointToLastMessage(provider)
      }

      if (this.taskHistory && historyEntry.debug) {
        historyEntry.debug.responses.push({
          timestamp: Date.now(),
          content: result.text,
          usage: {
            tokensIn: result.usage?.promptTokens || 0,
            tokensOut: result.usage?.completionTokens || 0,
            providerMetadata: result.providerMetadata,
          },
        })
        historyEntry.tokensIn += result.usage?.promptTokens || 0
        historyEntry.tokensOut += result.usage?.completionTokens || 0
        this.taskHistory.saveTask(historyEntry).catch(console.error)
      }

      return result.text
    } catch (error) {
      if (isVerbose) {
        log.system(`\n❌ Error in task execution: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (this.taskHistory && historyEntry.debug) {
        historyEntry.debug.responses.push({
          timestamp: Date.now(),
          content: error instanceof Error ? error.message : String(error),
          usage: {
            tokensIn: 0,
            tokensOut: 0,
            providerMetadata: {},
          },
        })
        // Add to tool usage for error tracking
        historyEntry.debug.toolUsage.push({
          timestamp: Date.now(),
          tool: 'task',
          params: {},
          result: error instanceof Error ? error.message : String(error),
          error: true,
        })
        this.taskHistory.saveTask(historyEntry).catch(console.error)
      }
      throw error
    }
  }
}

/**
 * Creates a new Agent instance with the provided configuration.
 *
 * @param config - The configuration options for the agent
 * @returns A new Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   name: 'MyAssistant',
 *   description: 'A helpful assistant',
 *   role: 'You are a helpful assistant that answers questions accurately.',
 *   model: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
 *   verbose: true
 * });
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config)
}
