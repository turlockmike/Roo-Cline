import { Tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

export const readFileTool: Tool = {
  description: "Read the contents of a file at the specified path. Returns the file content with line numbers prefixed to each line.",
  parameters: z.object({
    path: z.string().describe('The path of the file to read (relative to the current working directory)')
  }),
  execute: async ({ path: filePath }) => {
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
      // Read file content
      const content = await fs.readFile(absolutePath, 'utf-8');
      
      // Handle empty files
      if (!content.trim()) {
        return {
          content: [{
            type: "text",
            text: ""
          }]
        };
      }

      // Add line numbers
      const numberedLines = content.split('\n').map((line, index) => 
        `${index + 1} | ${line}`
      ).join('\n');
      return {
        content: [{
          type: "text",
          text: numberedLines
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error reading file: ${errorMessage}`
        }]
      };
    }
  }
};