import { z } from 'zod'

// Task execution function type
export type TaskExecutor<TInput = unknown, TOutput = unknown> = (input: TInput) => Promise<TOutput>

// Workflow builder types
interface WorkflowBuilder<TInput = unknown, TResults extends Record<string, unknown> = Record<string, unknown>> {
  input: TInput

  task<TTaskInput, TTaskOutput>(
    name: string,
    executor: TaskExecutor<TTaskInput, TTaskOutput>,
    input: TTaskInput,
  ): Promise<TTaskOutput>

  when<T extends TResults>(
    condition: (results: T) => boolean,
    builder: (builder: WorkflowBuilder<TInput, T>) => WorkflowBuilder<TInput, T>,
  ): WorkflowBuilder<TInput, TResults>

  parallel<TTasks extends ReadonlyArray<{ name: string; task: TaskExecutor<any, any>; input: any }>>(
    tasks: TTasks,
  ): Promise<{ [K in keyof TTasks]: TTasks[K] extends { task: TaskExecutor<any, infer TOutput> } ? TOutput : never }>

  success<T>(result: T): T

  fail(message: string): never

  run(): Promise<TResults>
}

export interface WorkflowConfig<TInput = unknown, TOutput extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  description: string
  // Event handlers
  onTaskStart?: (taskName: string) => void
  onTaskComplete?: (taskName: string, result: unknown) => void
  onWorkflowStart?: (workflowName: string, input: TInput) => void
  onWorkflowComplete?: (workflowName: string, output: TOutput) => void
  onError?: (error: Error) => void
}

export interface Workflow<TInput = unknown, TOutput extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  description: string
  run(input: TInput): Promise<TOutput>
  run(input: TInput, options: { outputSchema: z.ZodType<TOutput> }): Promise<TOutput>
}

class WorkflowBuilderImpl<TInput = unknown, TResults extends Record<string, unknown> = Record<string, unknown>>
  implements WorkflowBuilder<TInput, TResults>
{
  public readonly input: TInput

  private tasks: Array<{
    name: string
    executor: (input: unknown) => Promise<unknown>
    input: unknown
  }> = []

  private conditionalTasks: Array<{
    condition: (results: TResults) => boolean
    builder: (builder: WorkflowBuilder<TInput, TResults>) => WorkflowBuilder<TInput, TResults>
  }> = []

  constructor(private config: WorkflowConfig<TInput>, input: TInput) {
    this.input = input
  }

  async task<TTaskInput, TTaskOutput>(
    name: string,
    executor: TaskExecutor<TTaskInput, TTaskOutput>,
    input: TTaskInput,
  ): Promise<TTaskOutput> {
    // Emit task start event
    this.config.onTaskStart?.(name)

    try {
      // Execute task
      const result = await executor(input)

      // Store result for later use in workflow
      this.tasks.push({
        name,
        executor: async () => result,
        input,
      })

      // Emit task complete event
      this.config.onTaskComplete?.(name, result)

      return result
    } catch (error) {
      console.error('Task failed', name, error)
      const taskError = error instanceof Error ? error : new Error(String(error))
      throw new Error(`Workflow '${this.config.name}' failed: Task '${name}' failed: ${taskError.message}`)
    }
  }

  when<T extends TResults>(
    condition: (results: T) => boolean,
    builder: (builder: WorkflowBuilder<TInput, T>) => WorkflowBuilder<TInput, T>,
  ): WorkflowBuilder<TInput, TResults> {
    this.conditionalTasks.push({
      condition: results => {
        try {
          return condition(results as T)
        } catch (error) {
          return false
        }
      },
      builder: b => builder(b as WorkflowBuilder<TInput, T>),
    })
    return this
  }

  parallel<TTasks extends ReadonlyArray<{ name: string; task: TaskExecutor<any, any>; input: any }>>(
    tasks: TTasks,
  ): Promise<{ [K in keyof TTasks]: TTasks[K] extends { task: TaskExecutor<any, infer TOutput> } ? TOutput : never }> {
    const promises = tasks.map(async ({ name, task, input }) => {
      this.config.onTaskStart?.(name)
      try {
        const result = await task(input)
        this.config.onTaskComplete?.(name, result)
        return result
      } catch (error) {
        const taskError = error instanceof Error ? error : new Error(String(error))
        throw new Error(`Task '${name}' failed: ${taskError.message}`)
      }
    })
    return Promise.all(promises) as any
  }

  success<T>(result: T): T {
    return result
  }

  fail(message: string): never {
    throw new Error(message)
  }

  async run(): Promise<TResults> {
    const results: Record<string, unknown> = {}

    for (const task of this.tasks) {
      // Emit task start event
      this.config.onTaskStart?.(task.name)

      // Execute task
      const result = await task.executor(task.input)
      results[task.name] = result

      // Emit task complete event
      this.config.onTaskComplete?.(task.name, result)

      // Check conditional tasks after each task execution
      for (const conditional of this.conditionalTasks) {
        if (conditional.condition(results as TResults)) {
          const conditionalBuilder = new WorkflowBuilderImpl<TInput, TResults>(this.config, this.input)
          const builtConditional = conditional.builder(conditionalBuilder)
          const conditionalResults = await builtConditional.run()
          Object.assign(results, conditionalResults)
        }
      }
    }

    return results as TResults
  }
}

type WorkflowBuilderFunction<TInput, TOutput extends Record<string, unknown>> = (
  workflow: WorkflowBuilder<TInput, TOutput>,
) => Promise<TOutput | WorkflowBuilder<TInput, TOutput>>

export function createWorkflow<TInput = unknown, TOutput extends Record<string, unknown> = Record<string, unknown>>(
  config: WorkflowConfig<TInput, TOutput>,
  builder?: WorkflowBuilderFunction<TInput, TOutput>,
): Workflow<TInput, TOutput> {
  if (!config.name) {
    throw new Error('name is required')
  }

  return {
    name: config.name,
    description: config.description,
    run: async (input: TInput, options?: { outputSchema: z.ZodType<TOutput> }): Promise<TOutput> => {
      try {
        // Notify workflow start
        config.onWorkflowStart?.(config.name, input)

        if (!builder) {
          throw new Error('Builder function is required')
        }

        // Create workflow builder with input
        const workflowBuilder = new WorkflowBuilderImpl<TInput, TOutput>(config, input)

        // Execute builder function
        const builderResult = await builder(workflowBuilder)

        // Get output
        const output = builderResult instanceof WorkflowBuilderImpl ? await builderResult.run() : builderResult

        // Validate output if schema provided
        if (options?.outputSchema) {
          return options.outputSchema.parse(output)
        }

        // Notify workflow completion
        config.onWorkflowComplete?.(config.name, output)

        return output
      } catch (error) {
        // Create workflow error
        const workflowError =
          error instanceof Error
            ? new Error(`Workflow '${config.name}' failed: ${error.message}`)
            : new Error(`Workflow '${config.name}' failed: ${String(error)}`)

        // Notify error
        config.onError?.(workflowError)

        // Special handling for validation errors
        if (error instanceof z.ZodError) {
          throw new Error('Validation error')
        }

        throw workflowError
      }
    },
  }
}
