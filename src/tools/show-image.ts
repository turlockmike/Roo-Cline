import { Tool } from '@mastra/core/tools'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

export const showImageTool = new Tool({
  id: 'show-image',
  description: 'Display an image from a file path or URL. Supports common image formats (jpg, png, gif, etc).',
  inputSchema: z.object({
    source: z.string().describe('The path or URL of the image to display'),
    caption: z.string().optional().describe('Optional caption to display with the image'),
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.string(),
  }),
  execute: async ({ context: { source, caption } }) => {
    try {
      let imageData

      if (source.startsWith('http')) {
        // Handle URL
        const response = await fetch(source)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
        imageData = await response.arrayBuffer()
      } else {
        // Handle local file
        const absolutePath = path.resolve(process.cwd(), source)
        try {
          await fs.access(absolutePath)
        } catch {
          return {
            isError: true,
            content: `Image not found at path: ${source}`,
          }
        }
        imageData = await fs.readFile(absolutePath)
      }

      // Convert to base64
      const base64 = Buffer.from(imageData).toString('base64')
      const mimeType = getMimeType(source)
      const dataUrl = `data:${mimeType};base64,${base64}`

      return {
        isError: false,
        content: `![${caption || 'Image'}](${dataUrl})`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        isError: true,
        content: `Error displaying image: ${errorMessage}`,
      }
    }
  },
})

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}
