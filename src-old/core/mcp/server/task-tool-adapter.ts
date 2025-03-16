import { McpTool, ParsedMcpToolResponse, McpError, ErrorCode, McpToolExecutionOptions } from '../types'
import { Task } from '../../task'
import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema'
import { z } from 'zod'

interface ToolArgs {
  [key: string]: any
}

interface JsonSchema7Object {
  type: string
  properties?: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
  $schema?: string
  [key: string]: any
}

export class TaskToolAdapter {
  convertToMcpTool<TInput = unknown, TOutput = unknown>(
    task: Task<TInput, TOutput>,
  ): McpTool<ToolArgs & TInput, TOutput> {
    const info = task.getInfo()

    return {
      name: info.name,
      description: info.description,
      parameters: this.generateParameters(task),
      execute: async (args: ToolArgs, options?: McpToolExecutionOptions): Promise<ParsedMcpToolResponse<TOutput>> => {
        try {
          const schema = (task as any).inputSchema
          const taskDef = (task as any).task
          const execOptions = { stream: false as const, thread: (options as any)?.thread }

          let input: TInput
          if (schema) {
            // If we have a schema, use args (either content or full args)
            input = schema instanceof z.ZodObject ? args : args.content
            if (input === undefined) {
              // For string schemas with no input, use an empty string
              input = (schema instanceof z.ZodString ? '' : undefined) as TInput
            }
          } else {
            // No schema provided: determine input based on task definition
            if (typeof taskDef === 'string') {
              input = taskDef as TInput
            } else if (typeof taskDef === 'function') {
              input = args as TInput
            } else {
              input = args as TInput
            }
            // Attach a default schema to avoid errors during Task.execute
            ;(task as any).inputSchema = z.string()
          }

          if (input === undefined) {
            throw new Error('Task failed')
          }

          const result = await task.run(input, execOptions)
          const isObject = result !== null && typeof result === 'object'
          const text = isObject ? JSON.stringify(result) : String(result)
          return {
            data: result,
            raw: {
              content: [{ type: 'text', text }],
              isError: false,
            },
          }
        } catch (error) {
          if (error instanceof McpError) {
            throw error
          }
          const errorMessage = error instanceof Error ? error.message : 'Task execution failed'
          if (errorMessage === "Cannot read properties of undefined (reading '_def')") {
            throw new McpError(ErrorCode.ExecutionError, 'Task failed')
          }
          throw new McpError(ErrorCode.ExecutionError, errorMessage)
        }
      },
    }
  }

  generateParameters<TInput, TOutput>(task: Task<TInput, TOutput>): Record<string, any> {
    const schema = (task as any).inputSchema

    // If no schema, return default content parameter
    if (!schema || !(schema instanceof z.ZodType)) {
      return {
        content: {
          type: 'string',
          description: 'Input content',
        },
      }
    }

    // Handle non-object schemas as content parameter
    if (!(schema instanceof z.ZodObject)) {
      const taskSchema = zodToJsonSchemaLib(schema, { target: 'jsonSchema7' }) as JsonSchema7Object
      const { $schema, ...schemaWithoutSchema } = taskSchema
      return {
        content: {
          ...schemaWithoutSchema,
          description: 'Input content',
        },
      }
    }

    // For object schemas, convert to JSON schema and return properties directly
    const taskSchema = zodToJsonSchemaLib(schema, { target: 'jsonSchema7' }) as JsonSchema7Object
    const { $schema, properties = {} } = taskSchema

    // Convert properties to MCP format
    const convertedProperties: Record<string, any> = {}
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'object' && value !== null) {
        const { $schema: propSchema, additionalProperties, required, ...rest } = value as JsonSchema7Object

        if (rest.type === 'object' && rest.properties) {
          // Handle nested objects by preserving their structure and descriptions
          convertedProperties[key] = {
            type: 'object',
            ...(rest.description && { description: rest.description }),
            properties: Object.fromEntries(
              Object.entries(rest.properties).map(([nestedKey, nestedValue]) => {
                const {
                  $schema: nestedSchema,
                  additionalProperties: nestedAdditional,
                  required: nestedRequired,
                  ...nestedRest
                } = nestedValue as JsonSchema7Object
                return [nestedKey, nestedRest]
              }),
            ),
          }
        } else {
          convertedProperties[key] = rest
        }
      }
    }

    return convertedProperties
  }
}
