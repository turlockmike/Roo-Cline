// A helper that creates an async stream with push/end capabilities.
export function createAsyncStream<T>(): AsyncGenerator<T> & { push(item: T): void; end(): void } {
  const buffer: T[] = []
  let finished = false
  let resolver: ((result: IteratorResult<T>) => void) | null = null

  const generator = {
    async next(): Promise<IteratorResult<T>> {
      if (buffer.length > 0) {
        return { value: buffer.shift()!, done: false }
      }
      if (finished) {
        return { value: undefined as any, done: true }
      }
      return new Promise(resolve => {
        resolver = resolve
      })
    },
    async return(): Promise<IteratorResult<T>> {
      finished = true
      return { value: undefined as any, done: true }
    },
    async throw(err: any): Promise<IteratorResult<T>> {
      finished = true
      return { value: undefined as any, done: true }
    },
    [Symbol.asyncIterator]() {
      return this
    },
    // Implement dispose method without using Symbol.asyncDispose
    async dispose() {
      finished = true
    },
  }

  const stream = {
    push(item: T) {
      if (resolver) {
        resolver({ value: item, done: false })
        resolver = null
      } else {
        buffer.push(item)
      }
    },
    end() {
      finished = true
      if (resolver) {
        resolver({ value: undefined as any, done: true })
        resolver = null
      }
    },
  }

  return { ...generator, ...stream } as AsyncGenerator<T> & { push(item: T): void; end(): void }
}
