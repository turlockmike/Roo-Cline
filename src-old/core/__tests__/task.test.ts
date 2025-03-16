import { z } from 'zod'
import { Task, createTask, createStringTask, TaskConfig } from '../task'
import { Agent } from '../agent'
import { MockLanguageModelV1 } from 'ai/test'

describe('Task', () => {
  let agent: Agent
  let validConfig: TaskConfig<string>

  beforeEach(() => {
    // Create a real agent with mock model
    agent = new Agent({
      name: 'Test Agent',
      description: 'A test agent',
      role: 'test',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          text: 'Task result',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    })

    validConfig = {
      name: 'Test Task',
      description: 'A test task',
      agent,
      inputSchema: z.string(),
      task: 'Test prompt',
    }
  })

  describe('constructor validation', () => {
    it('should create a task with valid config', () => {
      const task = new Task(validConfig)
      expect(task.name).toBe('Test Task')
      expect(task.description).toBe('A test task')
    })

    it('should throw error if name is empty', () => {
      expect(() => new Task({ ...validConfig, name: '' })).toThrow('Task name cannot be empty')
    })

    it('should throw error if description is empty', () => {
      expect(() => new Task({ ...validConfig, description: '' })).toThrow('Task description cannot be empty')
    })

    it('should throw error if agent is not provided', () => {
      expect(() => new Task({ ...validConfig, agent: undefined as unknown as Agent })).toThrow(
        'Task must have an agent',
      )
    })

    it('should throw error if task is not provided', () => {
      expect(() => new Task({ ...validConfig, task: undefined as unknown as string })).toThrow(
        'Task must have a task definition',
      )
    })
  })

  describe('task execution', () => {
    it('should execute task with string prompt', async () => {
      const task = createStringTask({
        name: 'Test Task',
        description: 'A test task',
        agent,
        task: 'Test prompt',
      })

      const result = await task.run('test input')
      expect(result).toBe('Task result')
    })

    it('should execute task with function prompt', async () => {
      interface TestInput {
        message: string
      }
      const schema = z
        .object({
          message: z.string(),
        })
        .strict() as z.ZodType<TestInput>

      const task = new Task<TestInput>({
        name: 'Test Task',
        description: 'A test task',
        agent,
        inputSchema: schema,
        task: input => `Test prompt: ${input.message}`,
      })

      const result = await task.run({ message: 'Hello' })
      expect(result).toBe('Task result')
    })

    it('should execute task with schema validation', async () => {
      interface TestOutput {
        result: string
      }
      const schema = z
        .object({
          result: z.string(),
        })
        .strict() as z.ZodType<TestOutput>

      const mockModel = new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          text: JSON.stringify({ result: 'Success' }),
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      })

      const schemaAgent = new Agent({
        name: 'Test Agent',
        description: 'A test agent',
        role: 'test',
        model: mockModel,
      })

      const task = createStringTask<TestOutput>({
        name: 'Test Task',
        description: 'A test task',
        agent: schemaAgent,
        outputSchema: schema,
        task: 'Test prompt',
      })

      const result = await task.run('test input')
      expect(result).toEqual({ result: 'Success' })
    })

    it('should support streaming option', async () => {
      const mockModel = new MockLanguageModelV1({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'text-delta', textDelta: 'streaming' })
              controller.enqueue({ type: 'text-delta', textDelta: 'result' })
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
              })
              controller.close()
            },
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      })

      const streamAgent = new Agent({
        name: 'Test Agent',
        description: 'A test agent',
        role: 'test',
        model: mockModel,
      })

      const task = createStringTask({
        name: 'Test Task',
        description: 'A test task',
        agent: streamAgent,
        task: 'Test prompt',
      })

      const result = await task.run('test input', { stream: true })
      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }

      expect(chunks).toEqual(['streaming', 'result'])
    })
  })

  describe('getInfo', () => {
    it('should return task information', () => {
      const task = new Task(validConfig)
      const info = task.getInfo()
      expect(info).toEqual({
        name: 'Test Task',
        description: 'A test task',
      })
    })
  })
})

describe('createTask', () => {
  let agent: Agent
  let validConfig: TaskConfig<string>

  beforeEach(() => {
    agent = new Agent({
      name: 'Test Agent',
      description: 'A test agent',
      role: 'test',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          text: 'Task result',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    })

    validConfig = {
      name: 'Test Task',
      description: 'A test task',
      agent,
      inputSchema: z.string(),
      task: 'Test prompt',
    }
  })

  it('should create a Task instance', async () => {
    const task = createTask(validConfig)
    expect(task).toBeInstanceOf(Task)
    const result = await task.run('test input')
    expect(result).toBe('Task result')
  })

  it('should support streaming in created task', async () => {
    const mockModel = new MockLanguageModelV1({
      doStream: async () => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'streaming' })
            controller.enqueue({ type: 'text-delta', textDelta: 'result' })
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
            })
            controller.close()
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    })

    const streamAgent = new Agent({
      name: 'Test Agent',
      description: 'A test agent',
      role: 'test',
      model: mockModel,
    })

    const task = createStringTask({
      name: 'Test Task',
      description: 'A test task',
      agent: streamAgent,
      task: 'Test prompt',
    })

    const result = await task.run('test input', { stream: true })
    const chunks: string[] = []
    for await (const chunk of result) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(['streaming', 'result'])
  })

  it('should ensure the task function itself has an input schema matching the task config', async () => {
    const task = createTask({
      name: 'Test Task',
      description: 'A test task',
      agent,
      inputSchema: z.object({
        message: z.string(),
      }),
      task: input => `Test prompt: ${input.message}`,
    })

    const result = await task.run({ message: 'Hello' })
    expect(result).toBe('Task result')
  })

  it('should handle typed inputs and outputs with schema validation', async () => {
    interface Input {
      message: string
    }
    interface Output {
      result: string
    }

    const mockModel = new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => ({
        text: JSON.stringify({ result: 'Success' }),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    })

    const schemaAgent = new Agent({
      name: 'Test Agent',
      description: 'A test agent',
      role: 'test',
      model: mockModel,
    })

    const inputSchema = z
      .object({
        message: z.string(),
      })
      .strict() as z.ZodType<Input>

    const outputSchema = z
      .object({
        result: z.string(),
      })
      .strict() as z.ZodType<Output>

    const task = new Task<Input, Output>({
      name: 'Test Task',
      description: 'A test task',
      agent: schemaAgent,
      inputSchema,
      outputSchema,
      task: input => `Test prompt: ${input.message}`,
    })

    const result = await task.run({ message: 'Hello' })
    expect(result).toEqual({ result: 'Success' })
  })
})
