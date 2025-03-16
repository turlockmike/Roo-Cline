import { Tool } from 'ai';
import { z } from 'zod';

/**
 * A tool for fetching content from URLs with support for different response formats and custom headers.
 *
 * @example
 * // Basic usage to fetch text content
 * const result = await fetchTool.execute({ url: 'https://example.com' });
 *
 * @example
 * // Fetch JSON content with custom headers
 * const result = await fetchTool.execute({
 *   url: 'https://api.example.com/data',
 *   format: 'json',
 *   headers: JSON.stringify({ 'Authorization': 'Bearer token123' })
 * });
 *
 * @throws Will return an error object if the fetch operation fails or returns a non-OK status
 */
export const fetchTool: Tool = {
  description: "Fetches content from a URL. Supports different response formats (html, json, text) and custom headers.",
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch from'),
    format: z.enum(['json', 'text', 'html']).optional().describe('The expected response format. Defaults to text.'),
    headers: z.string().optional().describe('A JSON string containing custom headers to send with the request')
  }),
  /**
   * Executes the fetch operation with the provided parameters
   *
   * @param {Object} params - The parameters for the fetch operation
   * @param {string} params.url - The URL to fetch from
   * @param {('json'|'text'|'html')} [params.format='text'] - The expected response format
   * @param {string} [params.headers] - A JSON string containing custom headers
   * @return {Promise<Object>} An object containing either the fetched content or error information
   * @return {boolean} [return.isError] - Present and set to true if an error occurred
   * @return {Array<{type: string, text: string}>} return.content - The fetched content or error message
   */
  execute: async ({ url, format = 'text', headers: headersStr }) => {
    try {
      // Parse headers if provided
      const headers = headersStr ? JSON.parse(headersStr) : {};

      // Make the request
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `HTTP error ${response.status}: ${response.statusText}`
          }]
        };
      }

      // Handle response based on format
      let content;
      switch (format) {
        case 'json':
          content = await response.json();
          content = JSON.stringify(content, null, 2);
          break;
        case 'html':
          content = await response.text();
          break;
        default:
          content = await response.text();
      }

      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
};