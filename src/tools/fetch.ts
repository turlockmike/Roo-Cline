import { Tool } from '@mastra/core/tools';
import { z } from 'zod';

const ResponseFormat = {
  json: 'json',
  text: 'text',
  html: 'html'
} as const;

type ResponseFormat = typeof ResponseFormat[keyof typeof ResponseFormat];

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
 */
export const fetchTool = new Tool({
  id: 'fetch',
  description: "Fetches content from a URL. Supports different response formats (html, json, text) and custom headers.",
  inputSchema: z.object({
    url: z.string().url().describe('The URL to fetch from'),
    format: z.enum(['json', 'text', 'html'] as const).optional().describe('The expected response format. Defaults to text.'),
    headers: z.string().optional().describe('A JSON string containing custom headers to send with the request')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      data: z.string(),
      format: z.enum(['json', 'text', 'html'] as const),
      statusCode: z.number().optional(),
      statusText: z.string().optional()
    })
  }),
  execute: async ({ context: { url, format = ResponseFormat.text, headers: headersStr } }) => {
    try {
      // Parse headers if provided
      const headers = headersStr ? JSON.parse(headersStr) : {};

      // Make the request
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return {
          isError: true,
          content: {
            data: `HTTP error ${response.status}: ${response.statusText}`,
            format: ResponseFormat.text,
            statusCode: response.status,
            statusText: response.statusText
          }
        };
      }

      // Handle response based on format
      let data;
      switch (format) {
        case ResponseFormat.json:
          const jsonData = await response.json();
          data = JSON.stringify(jsonData, null, 2);
          break;
        case ResponseFormat.html:
          data = await response.text();
          break;
        default:
          data = await response.text();
      }

      return {
        isError: false,
        content: {
          data,
          format,
          statusCode: response.status,
          statusText: response.statusText
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          data: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`,
          format: ResponseFormat.text
        }
      };
    }
  }
}); 