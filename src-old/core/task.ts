import { z } from 'zod'
import { Agent } from './agent.js'
import { AsyncIterableStream } from './types.js'
import { Thread } from './thread/thread.js'
import { LanguageModelV1 } from 'ai'

export interface TaskConfig<TInput = string, TOutput = unknown> {
  name: string
  description: string
  agent: Agent
  inputSchema?: z.ZodType<TInput>
  outputSchema?: z.ZodType<TOutput>
  task: TInput extends string ? string | ((input: string) => string) : (input: TInput) => string
}

export class Task<TInput = string, TOutput = unknown> {
  public readonly name: string
  public readonly description: string
  private readonly agent: Agent
  public readonly inputSchema: z.ZodType<TInput>
  private readonly outputSchema?: z.ZodType<TOutput>
  private readonly task: TInput extends string ? string | ((input: string) => string) : (input: TInput) => string

  constructor(config: TaskConfig<TInput, TOutput>) {
    this.validateConfig(config)
    this.name = config.name
    this.description = config.description
    this.agent = config.agent
    this.inputSchema = config.inputSchema ?? (z.string() as unknown as z.ZodType<TInput, z.ZodTypeDef, TInput>)
    this.outputSchema = config.outputSchema
    this.task = config.task
  }

  private validateConfig(config: TaskConfig<TInput, TOutput>) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Task name cannot be empty')
    }
    if (!config.description || config.description.trim() === '') {
      throw new Error('Task description cannot be empty')
    }
    if (!config.agent) {
      throw new Error('Task must have an agent')
    }
    if (!config.task) {
      throw new Error('Task must have a task definition')
    }
  }

  private getTaskPrompt(input: TInput): string {
    if (typeof this.task === 'string') {
      return this.task
    }
    return (this.task as (input: TInput) => string)(input)
  }

  /**
   * Execute the task with the given input
   */
  async run(input: TInput): Promise<TOutput>
  async run(
    input: TInput,
    options: { stream: false; thread?: Thread; verbose?: boolean; model?: LanguageModelV1 },
  ): Promise<TOutput>
  async run(
    input: TInput,
    options: { stream: true; thread?: Thread; verbose?: boolean; model?: LanguageModelV1 },
  ): Promise<AsyncIterable<string> & ReadableStream<string>>
  async run(input: TInput, options: { thread?: Thread; verbose?: boolean; model?: LanguageModelV1 }): Promise<TOutput>
  async run(
    input: TInput,
    options?: { stream?: boolean; thread?: Thread; verbose?: boolean; model?: LanguageModelV1 },
  ): Promise<TOutput | AsyncIterableStream<string>> {
    // Validate input against schema
    const validInput = await this.inputSchema.parseAsync(input)
    // Generate prompt with validated input
    const prompt = this.getTaskPrompt(validInput)

    if (options?.stream) {
      return this.agent.task(prompt, {
        stream: true,
        thread: options.thread,
        verbose: options.verbose,
        model: options.model,
      })
    }
    if (this.outputSchema) {
      const result = await this.agent.task<TOutput>(prompt, {
        schema: this.outputSchema,
        thread: options?.thread,
        verbose: options?.verbose,
        model: options?.model,
      })
      return result
    }
    return this.agent.task(prompt, {
      thread: options?.thread,
      verbose: options?.verbose,
      model: options?.model,
    }) as Promise<TOutput>
  }

  /**
   * Get information about the task
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
    }
  }
}

/**
 * Create a new task with the given configuration
 * @param config The task configuration
 * @returns A Task instance
 */
export function createTask<TOutput = unknown>(
  config: Omit<TaskConfig<string, TOutput>, 'inputSchema'> & { inputSchema?: z.ZodString },
): Task<string, TOutput>

export function createTask<TInput, TOutput = unknown>(config: TaskConfig<TInput, TOutput>): Task<TInput, TOutput>

export function createTask<TInput, TOutput = unknown>(config: any): Task<TInput, TOutput> {
  return new Task<TInput, TOutput>({
    ...config,
    inputSchema: config.inputSchema ?? z.string(),
  })
}

/**
 * Helper function to create a task that accepts string input
 */
export function createStringTask<TOutput = unknown>(
  config: Omit<TaskConfig<string, TOutput>, 'inputSchema'> & { inputSchema?: z.ZodString },
): Task<string, TOutput> {
  return new Task<string, TOutput>({
    ...config,
    inputSchema: config.inputSchema ?? z.string(),
  })
}
