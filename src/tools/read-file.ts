import { Tool } from '@mastra/core/tools'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

export const readFileTool = new Tool({
  id: 'read-file',
  description:
    'Read the contents of a file at the specified path. Returns the file content with line numbers prefixed to each line. If reading the file fails, isError will be true and the content will be an error message.',
  inputSchema: z.object({
    path: z
      .string()
      .describe(
        'The path of the file to read Must provide the full file path (absolute path. Example: /Users/username/Documents/file.txt)',
      ),
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.string(),
  }),
  execute: async ({ context: { path: filePath } }) => {
    try {
      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        return {
          isError: true,
          content: `File not found at path: ${filePath}`,
        }
      }
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8')

      // Handle empty files
      if (!content.trim()) {
        return {
          isError: false,
          content: '',
        }
      }

      // Add line numbers
      const numberedLines = content
        .split('\n')
        .map((line, index) => `${index + 1} | ${line}`)
        .join('\n')
      return {
        isError: false,
        content: numberedLines,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        isError: true,
        content: `Error reading file: ${errorMessage}`,
      }
    }
  },
})
