import { z } from 'zod'

/**
 * Schema for template parameters
 * Defines how template strings are processed in tasks
 */
export const TaskTemplateSchema = z.object({
  template: z.string(),
  parameters: z.array(z.string()),
})

/**
 * Schema for task configuration
 * Defines the structure for a task configuration file
 */
export const TaskConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  agent: z.string(), // Reference to agent configuration
  schema: z.record(z.string(), z.unknown()).optional(), // Input/output schema as JSON Schema
  task: z.union([
    z.string(), // New format: Task template as a string
    TaskTemplateSchema, // Old format: Task template as an object
  ]),
  parameters: z.string().optional(), // Comma-separated list of parameters (for new format)
})

// TypeScript types
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>
export type TaskConfig = z.infer<typeof TaskConfigSchema>

/**
 * Default task configuration for code review
 */
export const DEFAULT_CODE_REVIEW_TASK: TaskConfig = {
  name: 'Code Review',
  description: 'Comprehensive code review for pull requests or specific files',
  agent: 'code-reviewer',
  schema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Array of file paths to review',
      },
      focus_areas: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Specific areas to focus review on',
      },
    },
    required: ['files'],
  },
  task: "Review the following files:\n${files.join('\\n- ')}\n\nFocus on the following areas:\n${focus_areas ? focus_areas.join('\\n- ') : 'All aspects of code quality and best practices'}",
  parameters: 'files,focus_areas',
}

/**
 * Default task configuration for code explanation
 */
export const DEFAULT_CODE_EXPLANATION_TASK: TaskConfig = {
  name: 'Explain Code',
  description: 'Detailed explanation of code functionality and structure',
  agent: 'code-assistant',
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File path to explain',
      },
      detail_level: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Level of detail in the explanation',
      },
    },
    required: ['file'],
  },
  task: "Explain the code in ${file} with ${detail_level || 'medium'} level of detail. Provide an overview of its purpose, structure, and key functions.",
  parameters: 'file,detail_level',
}
