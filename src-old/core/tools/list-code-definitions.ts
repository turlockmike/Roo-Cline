import { Tool } from 'ai'
import { z } from 'zod'
import * as path from 'path'
import { parseSourceCodeForDefinitionsTopLevel } from '../../services/tree-sitter'

export const listCodeDefinitionsTool: Tool = {
  description:
    'List definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This provides insights into the codebase structure and important constructs.',
  parameters: z.object({
    path: z.string().describe('The path of the directory to list top level source code definitions for'),
  }),
  execute: async ({ path: dirPath }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath)
      const definitions = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

      if (!definitions || definitions.trim() === '') {
        return {
          content: [
            {
              type: 'text',
              text: `No code definitions found in ${dirPath}`,
            },
          ],
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: definitions,
          },
        ],
      }
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error listing code definitions: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
}
