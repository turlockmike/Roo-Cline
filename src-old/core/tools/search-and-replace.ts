import { Tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper function to escape regex special characters for non-regex searches
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Operation schema for search and replace
const operationSchema = z.object({
  search: z.string().describe('The pattern to search for'),
  replace: z.string().describe('The replacement text'),
  start_line: z.number().optional().describe('Starting line number for the replacement (1-based)'),
  end_line: z.number().optional().describe('Ending line number for the replacement (1-based)'),
  use_regex: z.boolean().optional().describe('Whether to treat the search pattern as a regular expression'),
  ignore_case: z.boolean().optional().describe('Whether to ignore case in the search'),
  regex_flags: z.string().optional().describe('Custom regex flags (e.g., "gi" for global, case-insensitive)')
});

export const searchAndReplaceTool: Tool = {
  description: "Perform search and replace operations on a file, with support for regex patterns and line ranges.",
  parameters: z.object({
    path: z.string().describe('The path of the file to modify'),
    operations: z.array(operationSchema).describe('Array of search and replace operations to perform')
  }),
  execute: async ({ path: filePath, operations }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `File not found at path: ${filePath}`
          }]
        };
      }

      // Read the original file content
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      let lines = fileContent.split('\n');

      // Apply each operation in sequence
      for (const op of operations) {
        const flags = op.regex_flags ?? (op.ignore_case ? 'gi' : 'g');
        const multilineFlags = flags.includes('m') ? flags : flags + 'm';

        const searchPattern = op.use_regex
          ? new RegExp(op.search, multilineFlags)
          : new RegExp(escapeRegExp(op.search), multilineFlags);

        if (op.start_line || op.end_line) {
          // Line-range specific replacement
          const startLine = Math.max((op.start_line ?? 1) - 1, 0);
          const endLine = Math.min((op.end_line ?? lines.length) - 1, lines.length - 1);

          // Get the content before and after the target section
          const beforeLines = lines.slice(0, startLine);
          const afterLines = lines.slice(endLine + 1);

          // Get the target section and perform replacement
          const targetContent = lines.slice(startLine, endLine + 1).join('\n');
          const modifiedContent = targetContent.replace(searchPattern, op.replace);
          const modifiedLines = modifiedContent.split('\n');

          // Reconstruct the full content with the modified section
          lines = [...beforeLines, ...modifiedLines, ...afterLines];
        } else {
          // Global replacement
          const fullContent = lines.join('\n');
          const modifiedContent = fullContent.replace(searchPattern, op.replace);
          lines = modifiedContent.split('\n');
        }
      }

      const newContent = lines.join('\n');
      
      // Check if any changes were made
      if (newContent === fileContent) {
        return {
          content: [{
            type: "text",
            text: `No changes needed for '${filePath}'`
          }]
        };
      }

      // Write the modified content back to the file
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      return {
        content: [{
          type: "text",
          text: `Successfully applied ${operations.length} search and replace operation(s) to ${filePath}`
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error performing search and replace: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
};