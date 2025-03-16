import { Thread } from '../thread'
import fs from 'fs'
import path from 'path'
import { MemoryThreadStorage } from '../memory-storage'

describe('Thread', () => {
  let thread: Thread

  beforeEach(() => {
    thread = new Thread()
  })

  test('should add and retrieve messages', () => {
    thread.addMessage('user', 'Hello')
    thread.addMessage('assistant', 'Hi there!')
    const messages = thread.getMessages()
    expect(messages.length).toBe(2)
    expect(messages[0].content).toBe('Hello')
    expect(messages[1].content).toBe('Hi there!')
  })

  test('should clear messages', () => {
    thread.addMessage('user', 'Hello')
    thread.clearMessages()
    expect(thread.getMessages().length).toBe(0)
  })

  test('should add and manage contexts', () => {
    thread.addContext('testKey', { foo: 'bar' })
    expect(thread.hasContext('testKey')).toBeTruthy()
    const context = thread.getContext('testKey')
    expect(context).toBeDefined()
    if (context) {
      expect(context.value).toEqual({ foo: 'bar' })
    }
    let contexts = thread.getAllContexts()
    expect(contexts.get('testKey')).toBeDefined()
    thread.removeContext('testKey')
    expect(thread.hasContext('testKey')).toBeFalsy()
    // Add another context and then clear all
    thread.addContext('anotherKey', 123)
    thread.clearContexts()
    contexts = thread.getAllContexts()
    expect(contexts.size).toBe(0)
  })

  test('should add file context', () => {
    const fileContent = Buffer.from('file content')
    thread.addFileContext({
      key: 'file1',
      content: fileContent,
      filename: 'example.txt',
      mimeType: 'text/plain',
    })
    const context = thread.getContext('file1')
    expect(context).toBeDefined()
    if (context) {
      // Assuming file contexts store their value as an object with content, filename, and mimeType
      expect(context.value).toEqual({ content: fileContent, filename: 'example.txt', mimeType: 'text/plain' })
    }
  })

  test('should clone thread', () => {
    thread.addMessage('user', 'Hello')
    thread.addContext('key1', 'value1')
    const clonedThread = thread.clone()

    // Verify that messages and contexts are the same initially
    expect(clonedThread.getMessages()).toEqual(thread.getMessages())
    expect(Array.from(clonedThread.getAllContexts().entries())).toEqual(Array.from(thread.getAllContexts().entries()))

    // Modify the clone and ensure the original is not affected (deep copy check)
    clonedThread.addMessage('assistant', 'Hi')
    expect(thread.getMessages().length).toBe(1)

    // Similarly, change context in clone and original should remain unchanged
    clonedThread.addContext('newKey', 'newValue')
    expect(thread.hasContext('newKey')).toBeFalsy()
  })

  test('should merge threads', () => {
    thread.addMessage('user', 'Hello')
    thread.addContext('key1', 'value1')

    const anotherThread = new Thread()
    anotherThread.addMessage('assistant', 'Hi')
    anotherThread.addContext('key2', 'value2')

    thread.merge(anotherThread)
    const messages = thread.getMessages()
    expect(messages.length).toBe(2)
    expect(messages[0].content).toBe('Hello')
    expect(messages[1].content).toBe('Hi')
    expect(thread.hasContext('key1')).toBeTruthy()
    expect(thread.hasContext('key2')).toBeTruthy()
  })

  test('should serialize to JSON', () => {
    thread.addMessage('user', 'Hello JSON')
    thread.addContext('jsonKey', { number: 42 })
    const json = thread.toJSON()
    expect(json.messages.length).toBeGreaterThan(0)
    expect(json.contexts).toBeDefined()
  })

  test('should persist and load thread state', async () => {
    const storage = {
      save: jest.fn(),
    }
    const thread = new Thread({ storage })

    // Add some test data
    thread.addMessage('user', 'Persist me')
    thread.addContext('persistKey', { data: 'persisted' })
    await thread.save()
    expect(storage.save).toHaveBeenCalledWith(thread.toJSON())
  })

  describe('getFormattedMessages', () => {
    test('should format messages without context', () => {
      thread.addMessage('user', 'Hello')
      thread.addMessage('assistant', 'Hi there!')

      const formatted = thread.getFormattedMessages(false)
      expect(formatted).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ])
    })

    test('should format messages with context', () => {
      thread.addMessage('user', 'Hello')
      thread.addMessage('assistant', 'Hi there!')
      thread.addContext('testKey', { foo: 'bar' })
      thread.addContext('numberKey', 42)

      const formatted = thread.getFormattedMessages(true)
      expect(formatted).toEqual([
        { role: 'user', content: 'Context testKey: {"key":"testKey","value":{"foo":"bar"}}' },
        { role: 'user', content: 'Context numberKey: {"key":"numberKey","value":42}' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ])
    })

    test('should format messages with file context', () => {
      thread.addMessage('user', 'Check this file')
      const fileContent = Buffer.from('test content')
      thread.addFileContext({
        key: 'file1',
        content: fileContent,
        filename: 'test.txt',
        mimeType: 'text/plain',
      })

      const formatted = thread.getFormattedMessages(true)
      expect(formatted).toEqual([
        {
          role: 'user',
          content: expect.stringContaining(
            'Context file1: {"type":"file","key":"file1","value":{"content":{"type":"Buffer"',
          ),
        },
        { role: 'user', content: 'Check this file' },
      ])
    })

    test('should handle empty thread', () => {
      const formatted = thread.getFormattedMessages(true)
      expect(formatted).toEqual([])
    })
  })

  describe('truncate', () => {
    test('should truncate thread to respect max total tokens', () => {
      // Add messages that total to more than  400 chars
      thread.addMessage('user', 'A'.repeat(200))
      thread.addMessage('assistant', 'B'.repeat(300))
      thread.addMessage('user', 'C'.repeat(100))

      // Truncate to 400 chars
      const truncated = thread.truncate(400)
      const messages = truncated.getMessages()

      expect(messages[0].content).toBe('A'.repeat(200))
      expect(messages[1].content).toBe('B'.repeat(100))
      expect(messages[2].content).toBe('C'.repeat(100))
    })

    test('should preserve system message during truncation', () => {
      // Add a system message and several regular messages
      thread.addSystemMessage('X'.repeat(100))
      thread.addMessage('user', 'A'.repeat(200))
      thread.addMessage('assistant', 'B'.repeat(300))
      thread.addMessage('user', 'C'.repeat(100))

      // Truncate to a small token limit
      const truncated = thread.truncate(100)
      const messages = truncated.getMessages()

      // System message should be preserved
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('X'.repeat(100))

      // First message should be preserved
      expect(messages[1].content).toBe('A'.repeat(100)) // Truncated to 100 chars even though system message is 100 chars
      expect(messages[2]).toBeUndefined()
    })

    test('should truncate individual messages that exceed maxCharsPerMessage', () => {
      // Add a message that exceeds 40 chars
      thread.addMessage('user', 'A'.repeat(100))

      // Truncate with maxCharsPerMessage = 40
      const truncated = thread.truncate(1000, 40)
      const messages = truncated.getMessages()

      // Message should be truncated to 40 characters (10 tokens)
      expect(messages[0].content.length).toBe(40)
      expect(messages[0].content).toBe('A'.repeat(40))
    })

    test('should preserve message order after truncation', () => {
      thread.addMessage('user', 'First')
      thread.addMessage('assistant', 'Second')
      thread.addMessage('user', 'Third')

      const truncated = thread.truncate(1000)
      const messages = truncated.getMessages()

      expect(messages.length).toBe(3)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
      expect(messages[2].content).toBe('Third')
    })

    test('should handle empty thread', () => {
      const truncated = thread.truncate(100)
      expect(truncated.getMessages().length).toBe(0)
    })

    test('should preserve thread metadata and contexts after truncation', () => {
      thread.addMessage('user', 'Test message')
      thread.addContext('testKey', { foo: 'bar' })

      const truncated = thread.truncate(100)

      expect(truncated.getContext('testKey')).toBeDefined()
      expect(truncated.id).toBe(thread.id)
    })

    test('should use default maxCharsPerMessage when not specified', () => {
      // Add a message that exceeds default (50k chars)
      const longMessage = 'A'.repeat(250000)
      thread.addMessage('user', longMessage)

      const truncated = thread.truncate(300000)
      const messages = truncated.getMessages()

      // Message should be truncated to 50000 chars
      expect(messages[0].content.length).toBe(50000)
    })

    test('should always preserve the first message after truncation', () => {
      const firstMessage = 'First message that must be preserved'
      thread.addMessage('user', firstMessage)
      thread.addMessage('assistant', 'B'.repeat(300))
      thread.addMessage('user', 'C'.repeat(300))

      const truncated = thread.truncate(50)
      const messages = truncated.getMessages()

      // First message should always be present
      expect(messages[0].content).toBe(firstMessage)
      expect(messages[1].content).toBe('C'.repeat(50 - firstMessage.length))
      expect(messages.length).toBe(2) // First message + most recent that fits
    })

    test('should handle first message exceeding maxTokensPerMessage', () => {
      const longFirstMessage = 'A'.repeat(100)
      thread.addMessage('user', longFirstMessage)
      thread.addMessage('assistant', 'Short message')

      // Truncate with small maxTokensPerMessage
      const truncated = thread.truncate(1000, 40) // 10 tokens = 40 chars
      const messages = truncated.getMessages()

      // First message should be truncated but present
      expect(messages[0].content.length).toBe(40)
      expect(messages[0].content).toBe('A'.repeat(40))
      expect(messages[1].content).toBe('Short message')
    })

    test('should handle case where first message alone exceeds maxTokens', () => {
      const longFirstMessage = 'A'.repeat(1000) // 250 tokens
      thread.addMessage('user', longFirstMessage)
      thread.addMessage('assistant', 'Second message')

      // Truncate to less tokens than the first message
      const truncated = thread.truncate(400)
      const messages = truncated.getMessages()

      // Should still keep truncated first message
      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe(longFirstMessage.slice(0, 400))
    })
  })

  describe('System Messages', () => {
    test('should add and retrieve system message', () => {
      thread.addSystemMessage('You are a helpful assistant')
      expect(thread.hasSystemMessage()).toBeTruthy()
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toBe('You are a helpful assistant')
      expect(systemMessage?.role).toBe('system')
    })

    test('should throw error when adding second system message', () => {
      thread.addSystemMessage('You are a helpful assistant')
      expect(() => {
        thread.addSystemMessage('Another system message')
      }).toThrow('Thread already has a system message')
    })

    test('should add system message at the beginning of messages array', () => {
      thread.addMessage('user', 'Hello')
      thread.addSystemMessage('You are a helpful assistant')
      const messages = thread.getMessages()
      expect(messages.length).toBe(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })

    test('should include system message in formatted messages', () => {
      thread.addSystemMessage('You are a helpful assistant')
      thread.addMessage('user', 'Hello')
      const formatted = thread.getFormattedMessages()
      expect(formatted.length).toBe(2)
      expect(formatted[0].role).toBe('system')
      expect(formatted[0].content).toBe('You are a helpful assistant')
    })

    test('should respect the one system message rule when merging threads', () => {
      // Add a system message to the first thread
      thread.addSystemMessage('System message 1')
      thread.addMessage('user', 'Hello')

      // Create another thread with a system message
      const anotherThread = new Thread()
      anotherThread.addSystemMessage('System message 2')
      anotherThread.addMessage('assistant', 'Hi')

      // Merge the threads
      thread.merge(anotherThread)

      // Verify that the original system message is preserved
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toBe('System message 1')

      // Verify that all other messages were merged
      const messages = thread.getMessages()
      expect(messages.length).toBe(3) // system + user + assistant
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('System message 1')
    })

    test('should adopt system message from other thread when merging if none exists', () => {
      // First thread has no system message
      thread.addMessage('user', 'Hello')

      // Create another thread with a system message
      const anotherThread = new Thread()
      anotherThread.addSystemMessage('System message from other')
      anotherThread.addMessage('assistant', 'Hi')

      // Merge the threads
      thread.merge(anotherThread)

      // Verify that the system message from the other thread was adopted
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage).toBeDefined()
      expect(systemMessage?.content).toBe('System message from other')

      // Verify that all messages were merged properly
      const messages = thread.getMessages()
      expect(messages.length).toBe(3) // system + user + assistant
      expect(messages[0].role).toBe('system')
      expect(messages[0].content).toBe('System message from other')
    })
  })

  describe('Provider Options', () => {
    test('should add and retrieve provider options with messages', () => {
      const providerOptions = {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      }
      thread.addMessage('user', 'Hello', providerOptions)
      const messages = thread.getMessages()
      expect(messages[0].providerOptions).toEqual(providerOptions)
    })

    test('should add and retrieve provider options with system message', () => {
      const providerOptions = {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      }
      thread.addSystemMessage('You are a helpful assistant', providerOptions)
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions).toEqual(providerOptions)
    })

    test('should include provider options in formatted messages', () => {
      const providerOptions = {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      }
      thread.addSystemMessage('You are a helpful assistant', providerOptions)
      const formatted = thread.getFormattedMessages()
      expect(formatted[0].providerOptions).toEqual(providerOptions)
    })
  })

  describe('Cache Control Points', () => {
    test('should add cache control point to a message', () => {
      thread.addMessage('user', 'Hello')
      thread.addCacheControlPoint(0, 'anthropic')
      const messages = thread.getMessages()
      expect(messages[0].providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    test('should add cache control point to system message', () => {
      thread.addSystemMessage('You are a helpful assistant')
      const result = thread.addCacheControlPointToSystemMessage('anthropic')
      expect(result).toBeTruthy()
      const systemMessage = thread.getSystemMessage()
      expect(systemMessage?.providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    test('should add cache control point to last message', () => {
      thread.addMessage('user', 'Hello')
      thread.addMessage('assistant', 'Hi there!')
      const result = thread.addCacheControlPointToLastMessage('anthropic')
      expect(result).toBeTruthy()
      const messages = thread.getMessages()
      expect(messages[1].providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    test('should return false when adding cache control point to system message that does not exist', () => {
      const result = thread.addCacheControlPointToSystemMessage('anthropic')
      expect(result).toBeFalsy()
    })

    test('should return false when adding cache control point to last message in empty thread', () => {
      const result = thread.addCacheControlPointToLastMessage('anthropic')
      expect(result).toBeFalsy()
    })

    test('should throw error when adding cache control point to out of bounds message index', () => {
      expect(() => {
        thread.addCacheControlPoint(5, 'anthropic')
      }).toThrow('Message index 5 is out of bounds')
    })

    test('should add bedrock cache control point', () => {
      thread.addMessage('user', 'Hello')
      thread.addCacheControlPoint(0, 'bedrock')
      const messages = thread.getMessages()
      expect(messages[0].providerOptions?.bedrock?.cachePoints).toBeTruthy()
    })

    test('should add openrouter cache control point', () => {
      thread.addMessage('user', 'Hello')
      thread.addCacheControlPoint(0, 'openrouter')
      const messages = thread.getMessages()
      expect(messages[0].providerOptions?.openrouter?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    test('should add vertex cache control point (same as anthropic)', () => {
      thread.addMessage('user', 'Hello')
      thread.addCacheControlPoint(0, 'vertex')
      const messages = thread.getMessages()
      expect(messages[0].providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })

    test('should include cache control points in formatted messages', () => {
      thread.addSystemMessage('You are a helpful assistant')
      thread.addCacheControlPointToSystemMessage('anthropic')
      const formatted = thread.getFormattedMessages()
      expect(formatted[0].providerOptions?.anthropic?.cacheControl).toEqual({ type: 'ephemeral' })
    })
  })
})
