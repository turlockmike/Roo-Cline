import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as path from 'path';
import { parseSourceCodeForDefinitionsTopLevel } from '../lib/tree-sitter';

export const listCodeDefinitionsTool = new Tool({
  id: 'list-code-definitions',
  description: "List definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This provides insights into the codebase structure and important constructs.",
  inputSchema: z.object({
    path: z.string().describe('The path of the directory to list top level source code definitions for')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      definitions: z.string(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: dirPath } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const definitions = await parseSourceCodeForDefinitionsTopLevel(absolutePath);

      if (!definitions || definitions.trim() === '') {
        return {
          isError: false,
          content: {
            definitions: `No code definitions found in ${dirPath}`,
            path: dirPath
          }
        };
      }

      return {
        isError: false,
        content: {
          definitions,
          path: dirPath
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          definitions: `Error listing code definitions: ${error instanceof Error ? error.message : String(error)}`,
          path: dirPath
        }
      };
    }
  }
}); 