import { Tool } from 'ai'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Interface representing the result of a diff operation.
 *
 * @interface DiffResult
 * @property {boolean} success - Indicates whether the diff operation was successful.
 * @property {string} [content] - The modified content after applying the diff (only present if successful).
 * @property {string} [error] - Error message if the diff operation failed.
 * @property {unknown} [details] - Additional details about the operation or error.
 */
interface DiffResult {
  success: boolean
  content?: string
  error?: string
  details?: unknown
}

// Helper function to apply a diff block to content
function applyDiff(originalContent: string, diffContent: string, startLine?: number, endLine?: number): DiffResult {
  try {
    // Parse the diff content to extract search and replace blocks
    const searchMatch = diffContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/)
    if (!searchMatch) {
      return {
        success: false,
        error: 'Invalid diff format. Expected <<<<<<< SEARCH, =======, and >>>>>>> REPLACE markers.',
        details: { diffContent },
      }
    }

    const [, searchBlock, replaceBlock] = searchMatch
    const lines = originalContent.split('\n')

    // If line range is specified, only apply to that range
    if (typeof startLine === 'number' && typeof endLine === 'number') {
      if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        return {
          success: false,
          error: `Invalid line range: ${startLine}-${endLine}. File has ${lines.length} lines.`,
          details: { startLine, endLine, fileLength: lines.length },
        }
      }

      // Extract the target section
      const beforeSection = lines.slice(0, startLine - 1)
      const targetSection = lines.slice(startLine - 1, endLine).join('\n')
      const afterSection = lines.slice(endLine)

      // Check if the search block matches
      if (targetSection.trim() !== searchBlock.trim()) {
        return {
          success: false,
          error: 'Search content does not match the specified lines in the file.',
          details: {
            expected: searchBlock.trim(),
            found: targetSection.trim(),
            lineRange: `${startLine}-${endLine}`,
          },
        }
      }

      // Apply the replacement
      const modifiedContent = [...beforeSection, ...replaceBlock.split('\n'), ...afterSection].join('\n')

      return {
        success: true,
        content: modifiedContent,
      }
    }

    // If no line range, search the entire content
    const fullContent = lines.join('\n')
    if (!fullContent.includes(searchBlock.trim())) {
      return {
        success: false,
        error: 'Search content not found in file.',
        details: {
          searchContent: searchBlock.trim(),
        },
      }
    }

    // Apply the replacement to the full content
    const modifiedContent = fullContent.replace(searchBlock, replaceBlock)

    return {
      success: true,
      content: modifiedContent,
    }
  } catch (error) {
    return {
      success: false,
      error: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
      details: { error },
    }
  }
}

export const applyDiffTool: Tool = {
  description:
    'Apply a diff to a file, replacing specific content with new content. The diff should be in a block format with SEARCH and REPLACE sections.',
  parameters: z.object({
    path: z.string().describe('The path of the file to modify'),
    diff: z.string().describe('The diff content in block format with SEARCH and REPLACE sections'),
    start_line: z.number().optional().describe('Starting line number for the replacement (1-based)'),
    end_line: z.number().optional().describe('Ending line number for the replacement (1-based)'),
  }),
  execute: async ({ path: filePath, diff, start_line, end_line }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath)

      // Check if file exists
      try {
        await fs.access(absolutePath)
      } catch {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `File not found at path: ${filePath}`,
            },
          ],
        }
      }

      // Read the original content
      const originalContent = await fs.readFile(absolutePath, 'utf-8')

      // Apply the diff
      const result = applyDiff(originalContent, diff, start_line, end_line)

      if (!result.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to apply diff: ${result.error}`,
            },
          ],
        }
      }

      // Write the modified content back to the file
      await fs.writeFile(absolutePath, result.content!, 'utf-8')

      return {
        content: [
          {
            type: 'text',
            text: `Successfully applied diff to ${filePath}`,
          },
        ],
      }
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error applying diff: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
}
