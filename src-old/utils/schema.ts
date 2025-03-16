import { z } from 'zod'

type JsonSchemaType = {
  type?: string
  properties?: Record<string, any>
  required?: string[]
  items?: JsonSchemaType
  enum?: string[]
  oneOf?: JsonSchemaType[]
}

/**
 * Convert a Zod schema to JSON Schema format
 */
export function zodToJsonSchema(schema: z.ZodType<any>): JsonSchemaType {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape()
    const properties: Record<string, any> = {}
    const required: string[] = []

    Object.entries(shape).forEach(([key, value]) => {
      if (value instanceof z.ZodType) {
        properties[key] = zodTypeToJsonSchema(value)
        if (!value.isOptional()) {
          required.push(key)
        }
      }
    })

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    }
  }

  // Default to empty object schema if not an object schema
  return {
    type: 'object',
    properties: {},
  }
}

function zodTypeToJsonSchema(schema: z.ZodType<any>): JsonSchemaType {
  if (schema instanceof z.ZodString) {
    return { type: 'string' }
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' }
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' }
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(schema.element),
    }
  }
  if (schema instanceof z.ZodObject) {
    return zodToJsonSchema(schema)
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema._def.values,
    }
  }
  if (schema instanceof z.ZodUnion) {
    return {
      oneOf: schema._def.options.map((opt: z.ZodType) => zodTypeToJsonSchema(opt)),
    }
  }
  if (schema instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(schema._def.innerType)
  }
  if (schema instanceof z.ZodNullable) {
    return {
      oneOf: [zodTypeToJsonSchema(schema._def.innerType), { type: 'null' }],
    }
  }

  // Default to any type if unknown
  return {}
}

export function zodToSchemaString(schema: z.ZodType<any>): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape()
    const shapeEntries = Object.entries(shape).map(([key, value]) => {
      if (value instanceof z.ZodString) {
        return `"${key}": z.string()`
      }
      if (value instanceof z.ZodNumber) {
        return `"${key}": z.number()`
      }
      // Add more types as needed
      return `"${key}": z.unknown()`
    })
    return `{${shapeEntries.join(', ')}}`
  }
  // Handle other schema types as needed
  return 'z.unknown()'
}
