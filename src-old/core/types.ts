import { z } from 'zod'

export type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>
