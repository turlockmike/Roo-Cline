import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { distance } from 'fastest-levenshtein';

const BUFFER_LINES = 20; // Number of extra context lines to show before and after matches

function getSimilarity(original: string, search: string): number {
  if (search === "") {
    return 1;
  }

  // Normalize strings by removing extra whitespace but preserve case
  const normalizeStr = (str: string) => str.replace(/\s+/g, " ").trim();

  const normalizedOriginal = normalizeStr(original);
  const normalizedSearch = normalizeStr(search);

  if (normalizedOriginal === normalizedSearch) {
    return 1;
  }

  // Calculate Levenshtein distance
  const dist = distance(normalizedOriginal, normalizedSearch);

  // Calculate similarity ratio (0 to 1, where 1 is an exact match)
  const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length);
  return 1 - dist / maxLength;
}

export const searchAndReplaceTool = new Tool({
  id: 'search-and-replace',
  description: "Search and replace content in a file with support for fuzzy matching and line number targeting.",
  inputSchema: z.object({
    path: z.string().describe('The path of the file to modify'),
    search: z.string().describe('The content to search for'),
    replace: z.string().describe('The content to replace with'),
    start_line: z.number().optional().describe('Starting line number for the search (1-based)'),
    end_line: z.number().optional().describe('Ending line number for the search (1-based)'),
    fuzzy_threshold: z.number().optional().describe('Fuzzy matching threshold (0.0 to 1.0, default: 1.0 for exact match)')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string(),
      matchDetails: z.object({
        matchIndex: z.number(),
        similarity: z.number(),
        originalContent: z.string(),
        matchedContent: z.string()
      }).optional()
    })
  }),
  execute: async ({ context: { path: filePath, search, replace, start_line, end_line, fuzzy_threshold = 1.0 } }) => {
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
            path: filePath
          }
        };
      }

      // Read the file
      const originalContent = await fs.readFile(absolutePath, 'utf8');
      const lines = originalContent.split('\n');

      // Handle empty search
      if (!search.trim()) {
        if (!start_line || !end_line || start_line !== end_line) {
          return {
            isError: true,
            content: {
              message: 'Empty search requires exact line number for insertion',
              success: false,
              path: filePath
            }
          };
        }
      }

      // Determine search bounds
      let searchStartIndex = 0;
      let searchEndIndex = lines.length;
      if (start_line && end_line) {
        if (start_line < 1 || end_line > lines.length || start_line > end_line) {
          return {
            isError: true,
            content: {
              message: `Invalid line range: ${start_line}-${end_line} (file has ${lines.length} lines)`,
              success: false,
              path: filePath
            }
          };
        }
        searchStartIndex = Math.max(0, start_line - BUFFER_LINES - 1);
        searchEndIndex = Math.min(lines.length, end_line + BUFFER_LINES);
      }

      // Find best match
      let bestMatchIndex = -1;
      let bestMatchScore = 0;
      let bestMatchContent = '';

      // Try exact line range first if provided
      if (start_line && end_line) {
        const exactStartIndex = start_line - 1;
        const exactEndIndex = end_line - 1;
        const chunk = lines.slice(exactStartIndex, exactEndIndex + 1).join('\n');
        const similarity = getSimilarity(chunk, search);
        if (similarity >= fuzzy_threshold) {
          bestMatchIndex = exactStartIndex;
          bestMatchScore = similarity;
          bestMatchContent = chunk;
        }
      }

      // If no match found, search within bounds
      if (bestMatchIndex === -1) {
        const searchLines = search.split('\n');
        for (let i = searchStartIndex; i <= searchEndIndex - searchLines.length; i++) {
          const chunk = lines.slice(i, i + searchLines.length).join('\n');
          const similarity = getSimilarity(chunk, search);
          if (similarity > bestMatchScore) {
            bestMatchScore = similarity;
            bestMatchIndex = i;
            bestMatchContent = chunk;
          }
        }
      }

      // Check if match meets threshold
      if (bestMatchIndex === -1 || bestMatchScore < fuzzy_threshold) {
        return {
          isError: true,
          content: {
            message: `No match found meeting similarity threshold (${fuzzy_threshold})`,
            success: false,
            path: filePath,
            matchDetails: {
              matchIndex: bestMatchIndex,
              similarity: bestMatchScore,
              originalContent: search,
              matchedContent: bestMatchContent
            }
          }
        };
      }

      // Apply replacement
      const beforeLines = lines.slice(0, bestMatchIndex);
      const afterLines = lines.slice(bestMatchIndex + search.split('\n').length);
      const updatedContent = [...beforeLines, ...replace.split('\n'), ...afterLines].join('\n');

      // Write back to file
      await fs.writeFile(absolutePath, updatedContent, 'utf8');

      return {
        isError: false,
        content: {
          message: `Successfully replaced content at line ${bestMatchIndex + 1}`,
          success: true,
          path: filePath,
          matchDetails: {
            matchIndex: bestMatchIndex,
            similarity: bestMatchScore,
            originalContent: search,
            matchedContent: bestMatchContent
          }
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error performing search and replace: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: filePath
        }
      };
    }
  }
}); 