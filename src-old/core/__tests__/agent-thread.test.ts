import { z } from 'zod'
import { createAgent } from '../agent'
import { MockLanguageModelV1 } from 'ai/test'
import { Tool } from 'ai'
import { Thread } from '../thread/thread'

describe('Agent with Thread Integration', () => {
  // Create a mock tool for testing
  const mockTool: Tool = {
    description: 'A mock tool for testing',
    parameters: z.object({
      input: z.string(),
    }),
    execute: async ({ input }) => {
      return {
        content: `Executed mock tool with input: ${input}`,
      }
    },
  }

  let agent: ReturnType<typeof createAgent>
  let thread: Thread

  beforeEach(() => {
    thread = new Thread()
    agent = createAgent({
      name: 'Test Agent',
      role: 'You are a test agent',
      description: 'A test agent',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          text: 'Test response',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
      tools: {
        mock_tool: mockTool,
      },
    })
  })

  describe('task with thread', () => {
    it('should use thread messages in task execution', async () => {
      // Add some context and messages to the thread
      thread.addContext('testContext', { data: 'test data' })
      thread.addMessage('user', 'Previous message')
      thread.addMessage('assistant', 'Previous response')

      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'New response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      const threadAgent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: mockDoGenerate,
        }),
        tools: {
          mock_tool: mockTool,
        },
      })

      await threadAgent.task('Current task', { thread })

      // Verify that thread messages were included in the prompt
      expect(mockDoGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.any(String),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                {
                  type: 'text',
                  text: expect.stringContaining('Context testContext:'),
                },
              ]),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                {
                  type: 'text',
                  text: 'Previous message',
                },
              ]),
            }),
            expect.objectContaining({
              role: 'assistant',
              content: expect.arrayContaining([
                {
                  type: 'text',
                  text: 'Previous response',
                },
              ]),
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                {
                  type: 'text',
                  text: 'Current task',
                },
              ]),
            }),
          ]),
        }),
      )

      // Verify that the response was added to the thread
      const messages = thread.getMessages()
      expect(messages[messages.length - 1]).toMatchObject({
        role: 'assistant',
        content: 'New response',
        timestamp: expect.any(Date),
        providerOptions: {
          usage: {
            tokensIn: 10,
            tokensOut: 20,
          },
        },
      })
    })

    it('should handle streaming with thread', async () => {
      const streamAgent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'text-delta', textDelta: 'This' })
                controller.enqueue({ type: 'text-delta', textDelta: ' is' })
                controller.enqueue({ type: 'text-delta', textDelta: ' streaming' })
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
        }),
      })

      const result = await streamAgent.task('Stream test', {
        stream: true,
        thread,
      })

      const chunks: string[] = []
      for await (const chunk of result) {
        chunks.push(chunk)
      }

      // Verify streaming chunks
      expect(chunks).toEqual(['This', ' is', ' streaming'])

      // Verify that the complete response was added to the thread
      const messages = thread.getMessages()
      expect(messages[messages.length - 1]).toMatchObject({
        role: 'assistant',
        content: 'This is streaming',
        timestamp: expect.any(Date),
        providerOptions: {
          usage: {
            tokensIn: 10,
            tokensOut: 20,
          },
        },
      })
    })

    it('should handle schema validation with thread', async () => {
      const schema = z.object({
        count: z.number(),
      })

      const schemaAgent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: '{"count": 42}',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      })

      const result = await schemaAgent.task('Schema test', {
        schema,
        thread,
      })

      expect(result).toEqual({ count: 42 })

      // Verify that the JSON response was added to the thread
      const messages = thread.getMessages()
      expect(messages[messages.length - 1]).toMatchObject({
        role: 'assistant',
        content: '{"count":42}',
        timestamp: expect.any(Date),
        providerOptions: {
          usage: {
            tokensIn: 10,
            tokensOut: 20,
          },
        },
      })
    })

    it('should handle tool calls with thread', async () => {
      const toolAgent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async options => {
            // For object generation mode
            if (options.mode?.type === 'object-json') {
              return {
                text: JSON.stringify({ content: 'Executed mock tool with input: test input' }),
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                rawCall: { rawPrompt: null, rawSettings: {} },
              }
            }
            // For tool calls
            return {
              text: 'Using tool...',
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolCallType: 'function',
                  toolName: 'mock_tool',
                  args: JSON.stringify({ input: 'test input' }),
                },
              ],
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              rawCall: { rawPrompt: null, rawSettings: {} },
            }
          },
        }),
      })

      const result = await toolAgent.task('Tool test', {
        schema: z.object({
          content: z.string(),
        }),
        thread,
      })

      expect(result).toEqual({
        content: 'Executed mock tool with input: test input',
      })

      // Verify that both the tool call and final response were added to the thread
      const messages = thread.getMessages()
      expect(messages.length).toBe(3)
      expect(messages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining('ROLE:'),
        timestamp: expect.any(Date),
      })
      expect(messages[1]).toMatchObject({
        role: 'user',
        content: 'Tool test',
        timestamp: expect.any(Date),
      })
      expect(messages[2]).toMatchObject({
        role: 'assistant',
        content: JSON.stringify({ content: 'Executed mock tool with input: test input' }),
        timestamp: expect.any(Date),
      })
    })
  })
})
