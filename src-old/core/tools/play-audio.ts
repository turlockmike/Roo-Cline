import { Tool } from 'ai'
import { z } from 'zod'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as sound from 'sound-play'

// Supported audio formats
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']

export const playAudioTool: Tool = {
  description: 'Play an audio file or speak text using text-to-speech.',
  parameters: z.object({
    path: z.string().describe('The path to the audio file to play'),
  }),
  execute: async ({ path: audioPath }) => {
    try {
      // Handle audio file playback
      if (audioPath) {
        const absolutePath = path.resolve(process.cwd(), audioPath)

        // Check if file exists
        try {
          await fs.access(absolutePath)
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Audio file not found at path: ${audioPath}`,
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
                text: `Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
              },
            ],
          }
        }

        // Play the audio file
        const soundPromise = sound.play(absolutePath)

        // Set a timeout to ensure the sound handle is cleaned up
        const timeoutPromise = new Promise(resolve => {
          setTimeout(resolve, 1000) // Wait 1 second for the sound to start
        })

        // Wait for either the sound to finish or the timeout
        await Promise.race([soundPromise, timeoutPromise])

        return {
          content: [
            {
              type: 'text',
              text: `Playing audio file: ${audioPath}`,
            },
          ],
        }
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Either path or text must be provided',
          },
        ],
      }
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error playing audio: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
}
