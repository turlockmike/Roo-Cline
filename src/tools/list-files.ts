import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as path from 'path';
import { listFiles } from '../lib/list-files';

/**
 * Tool for listing files and directories within a specified directory.
 *
 * @remarks
 * This tool provides functionality to list files in a directory, with options for recursive listing.
 * It returns relative paths to make the output more readable and useful.
 *
 * @example
 * ```typescript
 * // List files in the current directory (non-recursive)
 * const result = await listFilesTool.execute({ path: '.' });
 *
 * // List all files recursively in the src directory
 * const recursiveResult = await listFilesTool.execute({ path: 'src', recursive: true });
 * ```
 */
export const listFilesTool = new Tool({
  id: 'list-files',
  description: "List files and directories within the specified directory. If recursive is true, it lists all files (with relative paths) recursively.",
  inputSchema: z.object({
    path: z.string().describe('The path of the directory to list contents for (relative to the current working directory)'),
    recursive: z.boolean().optional().describe('Set to true for a recursive listing, false or omitted for top-level only.')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      files: z.array(z.string()),
      hasMore: z.boolean(),
      totalCount: z.number(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: dirPath, recursive = false } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const [files, hasMore] = await listFiles(absolutePath, recursive, 1000);
      
      // Convert absolute paths to relative paths
      const relativePaths = files.map((file: string) => {
        const relPath = path.relative(absolutePath, file);
        // Remove trailing slash from directories and normalize path separators
        return relPath.replace(/[\\/]+$/, '').split(path.sep).join('/');
      });

      return {
        isError: false,
        content: {
          files: relativePaths.sort(),
          hasMore,
          totalCount: relativePaths.length,
          path: dirPath
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: {
          files: [],
          hasMore: false,
          totalCount: 0,
          path: dirPath
        }
      };
    }
  }
}); 