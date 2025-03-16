import { z } from 'zod'
import { createAgent } from '../agent'
import { MockLanguageModelV1 } from 'ai/test'
import { Thread } from '../thread/thread'

describe('Agent Prompt Caching', () => {
  describe('System Message Handling', () => {
    it('should add system message to thread if not present', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // Verify that a system message was added to the thread
      expect(thread.hasSystemMessage()).toBeTruthy()
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toContain('You are a test agent')
    })

    it('should not add system message if already present', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      thread.addSystemMessage('Custom system message')

      await agent.task('Test task', { thread })

      // Verify that the original system message was preserved
      expect(thread.hasSystemMessage()).toBeTruthy()
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toBe('Custom system message')
    })
  })

  describe('Provider Detection', () => {
    it('should detect Anthropic provider and add cache control points', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      // Mock Anthropic model
      class MockAnthropicModel extends MockLanguageModelV1 {
        constructor(options: any) {
          super(options)
        }
      }
      Object.defineProperty(MockAnthropicModel.prototype, 'constructor', {
        value: { name: 'AnthropicLanguageModel' },
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockAnthropicModel({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // Verify that cache control points were added
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })

      // Verify that the last message has cache control points
      const messages = thread.getMessages()
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    it('should detect OpenAI provider', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      // Mock OpenAI model
      class MockOpenAIModel extends MockLanguageModelV1 {
        constructor(options: any) {
          super(options)
        }
      }
      Object.defineProperty(MockOpenAIModel.prototype, 'constructor', {
        value: { name: 'OpenAILanguageModel' },
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockOpenAIModel({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // OpenAI doesn't need explicit cache control points, but we should still detect it
      const messages = thread.getMessages()
      expect(messages.length).toBeGreaterThan(1)
    })

    it('should detect Bedrock provider and add cache control points', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      // Mock Bedrock model
      class MockBedrockModel extends MockLanguageModelV1 {
        constructor(options: any) {
          super(options)
        }
      }
      Object.defineProperty(MockBedrockModel.prototype, 'constructor', {
        value: { name: 'BedrockLanguageModel' },
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockBedrockModel({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // Verify that cache control points were added
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions?.bedrock?.cachePoints).toBeTruthy()

      // Verify that the last message has cache control points
      const messages = thread.getMessages()
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.providerOptions?.bedrock?.cachePoints).toBeTruthy()
    })
  })

  describe('API Calls', () => {
    it('should not pass system property to generateText', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async options => {
        // Verify that system property is not passed
        expect(options.system).toBeUndefined()

        return {
          text: 'Test response',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      await agent.task('Test task')
      expect(mockDoGenerate).toHaveBeenCalled()
    })

    it('should include system message in formatted messages', async () => {
      let capturedMessages: any[] = []

      const mockDoGenerate = jest.fn().mockImplementation(async options => {
        // Capture the messages for verification
        capturedMessages = options.messages || []

        return {
          text: 'Test response',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })
      expect(mockDoGenerate).toHaveBeenCalled()

      // Verify that the thread has a system message
      expect(thread.hasSystemMessage()).toBeTruthy()
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toContain('You are a test agent')

      // Verify that messages include a system message
      const formattedMessages = thread.getFormattedMessages()
      const hasSystemMessage = formattedMessages.some((msg: any) => msg.role === 'system')
      expect(hasSystemMessage).toBeTruthy()
    })
  })

  describe('Caching Control', () => {
    it('should enable caching by default', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      // Mock Anthropic model
      class MockAnthropicModel extends MockLanguageModelV1 {
        constructor(options: any) {
          super(options)
        }
      }
      Object.defineProperty(MockAnthropicModel.prototype, 'constructor', {
        value: { name: 'AnthropicLanguageModel' },
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockAnthropicModel({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // Verify that cache control points were added
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })

      const messages = thread.getMessages()
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    it('should not add cache control points when caching is disabled', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async () => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }))

      // Mock Anthropic model
      class MockAnthropicModel extends MockLanguageModelV1 {
        constructor(options: any) {
          super(options)
        }
      }
      Object.defineProperty(MockAnthropicModel.prototype, 'constructor', {
        value: { name: 'AnthropicLanguageModel' },
      })

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockAnthropicModel({
          defaultObjectGenerationMode: 'json',
          doGenerate: mockDoGenerate,
        }),
        enableCaching: false,
      })

      const thread = new Thread()
      await agent.task('Test task', { thread })

      // Verify that no cache control points were added
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions?.anthropic?.cacheControl).toBeUndefined()

      const messages = thread.getMessages()
      const lastMessage = messages[messages.length - 1]
      expect(lastMessage.providerOptions?.anthropic?.cacheControl).toBeUndefined()
    })
  })
})
