import { Tool } from 'ai';
import { z } from 'zod';
import * as path from 'path';
import { listFiles } from '../../services/glob/list-files';

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
 *
 * @throws Will throw an error if the directory doesn't exist or cannot be accessed
 */
export const listFilesTool: Tool = {
  description: "List files and directories within the specified directory. If recursive is true, it lists all files (with relative paths) recursively.",
  parameters: z.object({
    path: z.string().describe('The path of the directory to list contents for (relative to the current working directory)'),
    recursive: z.boolean().optional().describe('Set to true for a recursive listing, false or omitted for top-level only.')
  }),
  /**
   * Executes the list files operation on the specified directory.
   *
   * @param options - The options for listing files
   * @param options.path - The directory path to list files from (relative to current working directory)
   * @param options.recursive - Whether to list files recursively (defaults to false)
   * @returns An object containing the listing results as formatted text
   * @throws Will throw and return an error message if the directory cannot be accessed
   */
  execute: async ({ path: dirPath, recursive = false }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), dirPath);
      const [files, hasMore] = await listFiles(absolutePath, recursive, 1000);
      
      // Convert absolute paths to relative paths
      const relativePaths = files.map(file => {
        const relPath = path.relative(absolutePath, file);
        // Remove trailing slash from directories and normalize path separators
        return relPath.replace(/[\\/]+$/, '').split(path.sep).join('/');
      });

      const message = relativePaths.length > 0 
        ? relativePaths.sort().join('\n') 
        : '(empty directory)';

      return {
        content: [{
          type: "text",
          text: hasMore ? `${message}\n(showing first 1000 entries)` : message
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error listing files: ${errorMessage}`
        }]
      };
    }
  }
};