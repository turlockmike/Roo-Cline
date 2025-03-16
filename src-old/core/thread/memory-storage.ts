import { Thread, ThreadState } from './thread'
import { ThreadStorage } from './thread'

/**
 * In-memory implementation of ThreadStorage interface.
 * Stores thread states in a Map for temporary persistence during runtime.
 */
export class MemoryThreadStorage implements ThreadStorage {
  /**
   * Internal storage for thread states, keyed by thread ID.
   * @private
   */
  private threads = new Map<string, ThreadState>()

  /**
   * Creates a new instance of MemoryThreadStorage.
   */
  constructor() {}

  /**
   * Saves a thread state to the in-memory storage.
   * @param state - The thread state to save
   * @returns A promise that resolves when the state has been saved
   */
  async save(state: ThreadState): Promise<void> {
    this.threads.set(state.id, state)
  }

  /**
   * Creates a new thread with optional ID.
   * @param threadId - Optional ID for the thread. If not provided, one will be generated.
   * @returns A new Thread instance
   */
  create(threadId?: string): Thread {
    return new Thread({ storage: this, id: threadId })
  }

  /**
   * Loads an existing thread by ID from memory.
   * @param threadId - The ID of the thread to load
   * @returns The loaded Thread instance
   * @throws Error if the thread with the specified ID is not found
   */
  load(threadId: string): Thread {
    const state = this.threads.get(threadId)
    if (!state) {
      throw new Error(`Thread not found: ${threadId}`)
    }
    return new Thread({
      storage: this,
      state,
    })
  }

  /**
   * Deletes a thread from memory by ID.
   * @param threadId - The ID of the thread to delete
   * @returns true if the thread was found and deleted, false otherwise
   */
  delete(threadId: string): boolean {
    return this.threads.delete(threadId)
  }

  /**
   * Removes all threads from memory storage.
   */
  clear(): void {
    this.threads.clear()
  }

  /**
   * Lists all thread IDs currently stored in memory.
   * @returns An array of thread IDs
   */
  list(): string[] {
    return Array.from(this.threads.keys())
  }
}
