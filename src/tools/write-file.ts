import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper to check if file exists
async function fileExistsAtPath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to preprocess content
function preprocessContent(content: string): string {
  let processedContent = content;

  // Remove markdown code block markers if present
  if (processedContent.startsWith("```")) {
    processedContent = processedContent.split("\n").slice(1).join("\n").trim();
  }
  if (processedContent.endsWith("```")) {
    processedContent = processedContent.split("\n").slice(0, -1).join("\n").trim();
  }

  // Fix common HTML entities
  processedContent = processedContent
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"');

  return processedContent;
}

// Helper to detect code omissions
function detectCodeOmission(content: string, predictedLineCount: number): boolean {
  const actualLineCount = content.split("\n").length;
  if (predictedLineCount !== 0 && actualLineCount !== predictedLineCount) {
    return true;
  }

  // Check for common code omission indicators
  const omissionIndicators = [
    '// rest of code unchanged',
    '/* previous code */',
    '// ... rest of the code ...',
    '// ... existing code ...',
    '/* ... */',
  ];

  return omissionIndicators.some(indicator => content.includes(indicator));
}

export const writeFileTool = new Tool({
  id: 'write-file',
  description: "Write content to a file at the specified path. Creates directories if they don't exist. If the file exists, it will be overwritten.",
  inputSchema: z.object({
    path: z.string().describe('The path of the file to write to (relative to the current working directory)'),
    content: z.string().describe('The content to write to the file. ALWAYS provide the COMPLETE intended content of the file.'),
    line_count: z.number().int().min(0).describe('The number of lines in the file')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string()
    })
  }),
  execute: async ({ context: { path: filePath, content, line_count } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      
      // Check if file exists
      const fileExists = await fileExistsAtPath(absolutePath);
      
      // Preprocess content
      const processedContent = preprocessContent(content);
      
      // Validate content and check for omissions
      if (detectCodeOmission(processedContent, line_count)) {
        return {
          isError: true,
          content: {
            message: `Content appears to be truncated or contains omission indicators. File has ${processedContent.split("\n").length} lines but was predicted to have ${line_count} lines. Please provide complete file content without omissions.`,
            success: false,
            path: filePath
          }
        };
      }

      // Validate line count matches content
      const actualLineCount = processedContent.split("\n").length;
      if (line_count !== 0 && actualLineCount !== line_count) {
        return {
          isError: true,
          content: {
            message: `Line count mismatch: expected ${line_count} but content has ${actualLineCount} lines`,
            success: false,
            path: filePath
          }
        };
      }

      // Create directories if they don't exist
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      
      // Write the file
      await fs.writeFile(absolutePath, processedContent, 'utf-8');
      
      const action = fileExists ? 'updated' : 'created';
      return {
        isError: false,
        content: {
          message: `File successfully ${action} at ${filePath}`,
          success: true,
          path: filePath
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: {
          message: `Error writing file: ${errorMessage}`,
          success: false,
          path: filePath
        }
      };
    }
  }
}); 