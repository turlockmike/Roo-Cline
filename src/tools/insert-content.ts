import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper function to insert groups of lines at specified indices
function insertGroups(
  lines: string[],
  groups: Array<{ index: number; elements: string[] }>
): string[] {
  // Sort groups by index in descending order to avoid affecting subsequent insertions
  const sortedGroups = [...groups].sort((a, b) => b.index - a.index);
  
  // Create a copy of the lines array
  let result = [...lines];
  
  // Insert each group
  for (const { index, elements } of sortedGroups) {
    // Ensure index is within bounds
    const insertAt = Math.max(0, Math.min(index, result.length));
    result.splice(insertAt, 0, ...elements);
  }
  
  return result;
}

export const insertContentTool = new Tool({
  id: 'insert-content',
  description: "Insert content at specific line numbers in a file. Multiple insertions can be performed in a single operation.",
  inputSchema: z.object({
    path: z.string().describe('The path of the file to modify'),
    operations: z.array(z.object({
      start_line: z.number().min(1).describe('The line number where content should be inserted (1-based)'),
      content: z.string().describe('The content to insert at the specified line')
    })).describe('Array of insert operations, each specifying where to insert content')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string(),
      operationsCount: z.number()
    })
  }),
  execute: async ({ context: { path: filePath, operations } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `File not found at path: ${filePath}`,
            success: false,
            path: filePath,
            operationsCount: 0
          }
        };
      }

      // Read the file
      const fileContent = await fs.readFile(absolutePath, 'utf8');
      const lines = fileContent.split('\n');

      // Prepare operations for insertion
      const insertOperations = operations.map((op) => ({
        index: op.start_line - 1, // Convert to 0-based index
        elements: op.content.split('\n')
      }));

      // Perform insertions
      const updatedLines = insertGroups(lines, insertOperations);
      const updatedContent = updatedLines.join('\n');

      // Check if any changes were made
      if (updatedContent === fileContent) {
        return {
          isError: false,
          content: {
            message: `No changes needed for '${filePath}'`,
            success: true,
            path: filePath,
            operationsCount: 0
          }
        };
      }

      // Write the modified content back to the file
      await fs.writeFile(absolutePath, updatedContent, 'utf-8');

      return {
        isError: false,
        content: {
          message: `Successfully inserted content at ${operations.length} location(s) in ${filePath}`,
          success: true,
          path: filePath,
          operationsCount: operations.length
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error inserting content: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: filePath,
          operationsCount: 0
        }
      };
    }
  }
}); 