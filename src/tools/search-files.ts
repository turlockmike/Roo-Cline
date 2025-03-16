import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fg from 'fast-glob';

export const searchFilesTool = new Tool({
  id: 'search-files',
  description: "Search for files in the workspace using glob patterns. Returns a list of matching files with their paths.",
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts" for all TypeScript files)'),
    ignore: z.array(z.string()).optional().describe('Patterns to ignore (e.g., ["node_modules/**"])')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.array(z.object({
      path: z.string(),
      size: z.number(),
      isDirectory: z.boolean(),
      modifiedTime: z.string()
    }))
  }),
  execute: async ({ context: { pattern, ignore = ['node_modules/**', '.git/**'] } }) => {
    try {
      const files = await fg(pattern, {
        ignore,
        onlyFiles: true
      });

      const results = await Promise.all(
        files.map(async (filePath) => {
          const stats = await fs.stat(filePath);
          return {
            path: filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            modifiedTime: stats.mtime.toISOString()
          };
        })
      );

      return {
        isError: false,
        content: results
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: []
      };
    }
  }
}); 