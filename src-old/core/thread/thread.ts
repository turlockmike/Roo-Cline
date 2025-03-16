import { MessageRole } from '../../lib/types'
import { randomUUID as uuid } from 'node:crypto'
import { CoreMessage } from 'ai'

/**
 * Represents a message within a thread.
 * @interface ThreadMessage
 */
export interface ThreadMessage {
  /** The role of the message sender (e.g., 'user', 'assistant') */
  role: MessageRole
  /** The text content of the message */
  content: string
  /** The timestamp when the message was created */
  timestamp: Date
  /** Provider-specific options for the message (e.g., cache control) */
  providerOptions?: Record<string, any>
}

/**
 * Represents a context item stored within a thread.
 * Context items provide additional information or state that can be referenced during the conversation.
 * @interface ThreadContext
 */
export interface ThreadContext {
  /** Unique identifier for the context item */
  key: string
  /** The value of the context item */
  value: any
  /** Optional metadata associated with this context item */
  metadata?: Record<string, any>
  /** Optional type identifier for the context item */
  type?: string
}

/**
 * Represents a file-based context item stored within a thread.
 * Extends the base ThreadContext to include file-specific properties.
 * @interface FileContext
 * @extends {ThreadContext}
 */
export interface FileContext extends ThreadContext {
  /** Type identifier specifying this is a file context */
  type: 'file'
  /** The file data and metadata */
  value: {
    /** The binary content of the file */
    content: Buffer
    /** The name of the file */
    filename: string
    /** The MIME type of the file */
    mimeType: string
  }
}

/**
 * Represents the complete state of a thread.
 * Contains all messages, contexts, and metadata associated with the thread.
 * @interface ThreadState
 */
export interface ThreadState {
  /** Unique identifier for the thread */
  id: string
  /** Array of messages in the thread */
  messages: ThreadMessage[]
  /** Optional system message for the thread */
  systemMessage?: ThreadMessage
  /** Map of context items associated with the thread */
  contexts: Map<string, ThreadContext>
  /** Additional metadata associated with the thread */
  metadata: Record<string, any>
  /** Timestamp when the thread was created */
  created: Date
  /** Timestamp when the thread was last updated */
  updated: Date
}

/**
 * Options for adding a file context to a thread.
 * @interface FileContextOptions
 */
export interface FileContextOptions {
  /** Unique identifier for the file context */
  key: string
  /** The binary content of the file */
  content: Buffer
  /** The name of the file */
  filename: string
  /** The MIME type of the file */
  mimeType: string
  /** Optional metadata associated with this file */
  metadata?: Record<string, any>
}

/**
 * Interface for thread persistence mechanisms.
 * Implementations of this interface handle saving thread state to a storage medium.
 * @interface ThreadStorage
 */
export interface ThreadStorage {
  /**
   * Saves the thread state to storage
   * @param state The thread state to save
   * @returns A promise that resolves when the save operation is complete
   */
  save(state: ThreadState): Promise<void>
}

/**
 * Represents a conversation thread with messages and contextual information.
 * Provides methods for managing messages, contexts, and thread state.
 */
export class Thread {
  private state: ThreadState
  private storage?: ThreadStorage

  /**
   * Creates a new Thread instance
   * @param options Configuration options for the thread
   * @param options.id Optional unique identifier for the thread (auto-generated if not provided)
   * @param options.storage Optional storage mechanism for persisting thread state
   * @param options.state Optional initial state for the thread
   */
  constructor(options?: { id?: string; storage?: ThreadStorage; state?: Partial<ThreadState> }) {
    this.state = {
      id: options?.id || options?.state?.id || uuid(),
      messages: options?.state?.messages || [],
      systemMessage: options?.state?.systemMessage,
      contexts: options?.state?.contexts || new Map<string, ThreadContext>(),
      metadata: options?.state?.metadata || {},
      created: options?.state?.created || new Date(),
      updated: options?.state?.updated || new Date(),
    }
    this.storage = options?.storage
  }

  /**
   * Gets the unique identifier of this thread
   * @returns The thread's unique ID
   */
  get id(): string {
    return this.state.id
  }

  // Message Management
  /**
   * Adds a new message to the thread
   * @param role The role of the message sender (e.g., 'user', 'assistant')
   * @param content The text content of the message
   * @param providerOptions Optional provider-specific options for the message (e.g., cache control)
   */
  addMessage(role: MessageRole, content: string, providerOptions?: Record<string, any>): void {
    const message: ThreadMessage = {
      role,
      content,
      timestamp: new Date(),
      providerOptions,
    }
    this.state.messages.push(message)
    this.state.updated = new Date()
  }

  /**
   * Checks if the thread has a system message
   * @returns True if the thread has a system message, false otherwise
   */
  hasSystemMessage(): boolean {
    return !!this.state.systemMessage
  }

  /**
   * Adds a system message to the thread
   * @param content The text content of the system message
   * @param providerOptions Optional provider-specific options for the message (e.g., cache control)
   * @throws Error if the thread already has a system message
   */
  addSystemMessage(content: string, providerOptions?: Record<string, any>): void {
    if (this.hasSystemMessage()) {
      throw new Error('Thread already has a system message. Only one system message is allowed per thread.')
    }

    this.state.systemMessage = {
      role: 'system',
      content,
      timestamp: new Date(),
      providerOptions,
    }
    this.state.updated = new Date()
  }

  /**
   * Gets the system message from the thread if it exists
   * @returns The system message if it exists, undefined otherwise
   */
  getSystemMessage(): ThreadMessage | undefined {
    return this.state.systemMessage
  }

  /**
   * Gets all messages in the thread
   * @returns Array of thread messages in chronological order, with system message first if it exists
   */
  getMessages(): ThreadMessage[] {
    const messages = [...this.state.messages]
    if (this.state.systemMessage) {
      messages.unshift(this.state.systemMessage)
    }
    return messages
  }

  /**
   * Get messages formatted for use with the AI SDK
   * @param includeContext Whether to include context messages at the start
   */
  getFormattedMessages(includeContext: boolean = true): CoreMessage[] {
    const messages: CoreMessage[] = []

    // Add system message first if it exists
    if (this.state.systemMessage) {
      messages.push({
        role: this.state.systemMessage.role,
        content: this.state.systemMessage.content,
        providerOptions: this.state.systemMessage.providerOptions,
      })
    }

    // Add context messages next if requested
    if (includeContext) {
      const contexts = this.getAllContexts()
      for (const [key, value] of contexts) {
        messages.push({
          role: 'user',
          content: `Context ${key}: ${JSON.stringify(value)}`,
        })
      }
    }

    // Add regular thread messages
    messages.push(
      ...this.state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        providerOptions: msg.providerOptions,
      })),
    )

    return messages
  }

  /**
   * Removes all messages from the thread
   * @returns void
   */
  clearMessages(): void {
    this.state.messages = []
    this.state.systemMessage = undefined
    this.state.updated = new Date()
  }

  // Context Management
  /**
   * Adds a context item to the thread
   * @param key The unique identifier for the context item
   * @param value The value to store in the context
   * @param metadata Optional metadata associated with this context item
   * @returns void
   */
  addContext(key: string, value: any, metadata?: Record<string, any>): void {
    this.state.contexts.set(key, {
      key,
      value,
      metadata,
    })
    this.state.updated = new Date()
  }

  /**
   * Retrieves a context item by its key
   * @param key The unique identifier of the context item to retrieve
   * @returns The context item if found, undefined otherwise
   */
  getContext(key: string): ThreadContext | undefined {
    return this.state.contexts.get(key)
  }

  /**
   * Checks if a context item with the specified key exists
   * @param key The unique identifier to check for
   * @returns True if the context exists, false otherwise
   */
  hasContext(key: string): boolean {
    return this.state.contexts.has(key)
  }

  /**
   * Removes a context item from the thread
   * @param key The unique identifier of the context item to remove
   * @returns True if the context was found and removed, false otherwise
   */
  removeContext(key: string): boolean {
    const result = this.state.contexts.delete(key)
    if (result) {
      this.state.updated = new Date()
    }
    return result
  }

  /**
   * Retrieves all context items in the thread
   * @returns A new Map containing all context items (to prevent direct modification)
   */
  getAllContexts(): Map<string, ThreadContext> {
    return new Map(this.state.contexts)
  }

  /**
   * Removes all context items from the thread
   * @returns void
   */
  clearContexts(): void {
    this.state.contexts.clear()
    this.state.updated = new Date()
  }

  // File Context Support
  /**
   * Adds a file as a context item to the thread
   * @param options Configuration options for the file context
   * @returns void
   */
  addFileContext(options: FileContextOptions): void {
    const fileContext: FileContext = {
      type: 'file',
      key: options.key,
      value: {
        content: options.content,
        filename: options.filename,
        mimeType: options.mimeType,
      },
      metadata: options.metadata,
    }
    this.state.contexts.set(options.key, fileContext)
    this.state.updated = new Date()
  }

  // Utilities
  /**
   * Creates a deep copy of this thread
   * @returns A new Thread instance with the same messages, contexts, and metadata
   */
  clone(): Thread {
    const clonedThread = new Thread()

    // Clone messages
    clonedThread.state.messages = this.state.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }))

    // Clone system message if it exists
    if (this.state.systemMessage) {
      clonedThread.state.systemMessage = {
        ...this.state.systemMessage,
        timestamp: new Date(this.state.systemMessage.timestamp),
      }
    }

    // Clone contexts (deep copy)
    this.state.contexts.forEach((context, key) => {
      if (context.type === 'file') {
        const fileContext = context as FileContext
        clonedThread.addFileContext({
          key: fileContext.key,
          content: Buffer.from(fileContext.value.content),
          filename: fileContext.value.filename,
          mimeType: fileContext.value.mimeType,
          metadata: fileContext.metadata ? { ...fileContext.metadata } : undefined,
        })
      } else {
        clonedThread.addContext(
          context.key,
          JSON.parse(JSON.stringify(context.value)),
          context.metadata ? { ...context.metadata } : undefined,
        )
      }
    })

    // Clone metadata
    clonedThread.state.metadata = { ...this.state.metadata }

    return clonedThread
  }

  /**
   * Merges another thread into this one
   * @param other The thread to merge into this one
   * @returns void
   *
   * @remarks
   * - Messages are merged and sorted chronologically
   * - Context items from the other thread override any with the same key in this thread
   * - Metadata is merged with the other thread's metadata taking precedence on conflicts
   * - If this thread doesn't have a system message but the other does, the other's system message is used
   */
  merge(other: Thread): void {
    // Merge messages (maintaining chronological order)
    const allMessages = [...this.state.messages, ...other.state.messages]
    this.state.messages = allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Merge system message (other thread's system message takes precedence)
    if (other.state.systemMessage && !this.state.systemMessage) {
      this.state.systemMessage = {
        ...other.state.systemMessage,
        timestamp: new Date(other.state.systemMessage.timestamp),
      }
    }

    // Merge contexts (other thread's contexts take precedence on conflict)
    other.getAllContexts().forEach((context, key) => {
      if (context.type === 'file') {
        const fileContext = context as FileContext
        this.addFileContext({
          key: fileContext.key,
          content: Buffer.from(fileContext.value.content),
          filename: fileContext.value.filename,
          mimeType: fileContext.value.mimeType,
          metadata: fileContext.metadata,
        })
      } else {
        this.addContext(context.key, context.value, context.metadata)
      }
    })

    // Merge metadata
    this.state.metadata = {
      ...this.state.metadata,
      ...other.state.metadata,
    }

    this.state.updated = new Date()
  }

  toJSON(): ThreadState {
    return {
      ...this.state,
      contexts: new Map(this.state.contexts),
    }
  }

  async save(): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage mechanism configured')
    }
    await this.storage.save(this.state)
  }

  private truncateMessage(message: ThreadMessage, maxChars: number): ThreadMessage {
    const truncatedMessage = { ...message }
    if (message.content.length > maxChars) {
      truncatedMessage.content = message.content.slice(0, maxChars)
    }
    return truncatedMessage
  }
  /**
   * Returns a truncated version of this thread, containing only the most recent messages such that
   * the estimated token count does not exceed maxTokens. The first message is always preserved.
   * Each individual message can also be truncated if it exceeds maxTokensPerMessage.
   * @param maxTokens The maximum number of tokens for the entire thread
   * @param maxTokensPerMessage Optional maximum number of tokens per individual message (defaults to 50000)
   */
  public truncate(maxChars: number = 100_000, maxCharsPerMessage: number = 50000): Thread {
    const realMaxCharsPerMessage = Math.min(maxCharsPerMessage, maxChars)

    let totalChars = 0
    const truncatedMessages: ThreadMessage[] = []

    const { systemMessage, messages } = this.state

    // System message should NEVER be truncated.
    const truncatedSystemMessage = systemMessage ? { ...systemMessage } : undefined

    if (truncatedSystemMessage) {
      totalChars += truncatedSystemMessage.content.length
    }

    if (messages.length === 0) {
      return new Thread({
        state: {
          ...this.state,
          systemMessage: truncatedSystemMessage,
          messages: [],
        },
      })
    }

    // First message always included
    const firstMessage = this.truncateMessage(messages[0], realMaxCharsPerMessage)
    totalChars += firstMessage.content.length

    // Prepare messages in priority order (last, second last, third last, etc.)
    const intermediateMessages: ThreadMessage[] = []
    for (let i = messages.length - 1; i > 0; i--) {
      const remainingChars = maxChars - totalChars
      if (remainingChars <= 0) {
        break
      }
      const msg = this.truncateMessage(messages[i], Math.min(realMaxCharsPerMessage, remainingChars))
      intermediateMessages.unshift(msg)
      totalChars += msg.content.length
    }

    // Add messages preserving order
    truncatedMessages.push(firstMessage)
    truncatedMessages.push(...intermediateMessages)

    return new Thread({
      state: {
        ...this.state,
        systemMessage: truncatedSystemMessage,
        messages: truncatedMessages,
      },
    })
  }

  /**
   * Adds a cache control point to a message
   * @param messageIndex The index of the message to add the cache control point to
   * @param provider The provider to add the cache control point for (e.g., 'anthropic', 'bedrock')
   * @throws Error if the message index is out of bounds
   */
  addCacheControlPoint(messageIndex: number, provider: string): void {
    if (messageIndex < 0 || messageIndex >= this.state.messages.length) {
      throw new Error(`Message index ${messageIndex} is out of bounds`)
    }

    const message = this.state.messages[messageIndex]
    if (!message.providerOptions) {
      message.providerOptions = {}
    }

    // Add provider-specific cache control
    if (provider === 'anthropic' || provider === 'vertex') {
      message.providerOptions.anthropic = {
        ...(message.providerOptions.anthropic || {}),
        cacheControl: { type: 'ephemeral' },
      }
    } else if (provider === 'bedrock') {
      message.providerOptions.bedrock = {
        ...(message.providerOptions.bedrock || {}),
        cachePoints: true,
      }
    } else if (provider === 'openrouter') {
      // OpenRouter follows Anthropic's pattern
      message.providerOptions.openrouter = {
        ...(message.providerOptions.openrouter || {}),
        cacheControl: { type: 'ephemeral' },
      }
    }

    this.state.updated = new Date()
  }

  /**
   * Adds a cache control point to the system message if it exists
   * @param provider The provider to add the cache control point for (e.g., 'anthropic', 'bedrock')
   * @returns True if the cache control point was added, false if there is no system message
   */
  addCacheControlPointToSystemMessage(provider: string): boolean {
    if (!this.state.systemMessage) {
      return false
    }

    if (!this.state.systemMessage.providerOptions) {
      this.state.systemMessage.providerOptions = {}
    }

    // Add provider-specific cache control
    if (provider === 'anthropic' || provider === 'vertex') {
      this.state.systemMessage.providerOptions.anthropic = {
        ...(this.state.systemMessage.providerOptions.anthropic || {}),
        cacheControl: { type: 'ephemeral' },
      }
    } else if (provider === 'bedrock') {
      this.state.systemMessage.providerOptions.bedrock = {
        ...(this.state.systemMessage.providerOptions.bedrock || {}),
        cachePoints: true,
      }
    } else if (provider === 'openrouter') {
      // OpenRouter follows Anthropic's pattern
      this.state.systemMessage.providerOptions.openrouter = {
        ...(this.state.systemMessage.providerOptions.openrouter || {}),
        cacheControl: { type: 'ephemeral' },
      }
    }

    this.state.updated = new Date()
    return true
  }

  /**
   * Adds a cache control point to the last message in the thread
   * @param provider The provider to add the cache control point for (e.g., 'anthropic', 'bedrock')
   * @returns True if the cache control point was added, false if there are no messages
   */
  addCacheControlPointToLastMessage(provider: string): boolean {
    if (this.state.messages.length === 0) {
      return false
    }

    this.addCacheControlPoint(this.state.messages.length - 1, provider)
    return true
  }
}
