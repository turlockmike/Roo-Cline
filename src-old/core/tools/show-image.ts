import { Tool } from 'ai'
import { z } from 'zod'
import * as path from 'path'
import * as fs from 'fs/promises'
import { platform } from 'os'
import { exec } from 'child_process'

// Supported image formats
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']

// Platform-specific open command
/**
 * Returns the platform-specific command to open an image file
 *
 * @param imagePath - The absolute path to the image file
 * @returns The command string to execute for opening the image
 * @throws Will throw an error if the current platform is not supported
 */
function getOpenCommand(imagePath: string): string {
  switch (platform()) {
    case 'win32':
      return `start "" "${imagePath}"`
    case 'darwin':
      return `open "${imagePath}"`
    case 'linux':
      return `xdg-open "${imagePath}"`
    default:
      throw new Error(`Unsupported platform: ${platform()}`)
  }
}

/**
 * Tool for displaying image files using the system's default image viewer.
 *
 * @example
 * ```typescript
 * // Display an image file
 * await showImageTool.execute({ path: './images/example.png' });
 * ```
 *
 * @throws Will throw an error if the platform is not supported
 * @throws Will return an error object if the file doesn't exist or has an unsupported format
 */
export const showImageTool: Tool = {
  description: "Display an image file using the system's default image viewer.",
  parameters: z.object({
    path: z.string().describe('The path to the image file to display'),
  }),
  execute: async ({ path: imagePath }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), imagePath)

      // Check if file exists
      try {
        await fs.access(absolutePath)
      } catch {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Image file not found at path: ${imagePath}`,
            },
          ],
        }
      }

      // Check file format
      const ext = path.extname(absolutePath).toLowerCase()
      if (!SUPPORTED_FORMATS.includes(ext)) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Unsupported image format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
            },
          ],
        }
      }

      // Get the platform-specific open command
      const command = getOpenCommand(absolutePath)

      // Execute the command
      return new Promise(resolve => {
        exec(command, error => {
          if (error) {
            resolve({
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error displaying image: ${error.message}`,
                },
              ],
            })
          } else {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Displaying image: ${imagePath}`,
                },
              ],
            })
          }
        })
      })
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error displaying image: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
}
