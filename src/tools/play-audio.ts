import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as sound from 'sound-play';

// Supported audio formats
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];

export const playAudioTool = new Tool({
  id: 'play-audio',
  description: "Play an audio file or speak text using text-to-speech.",
  inputSchema: z.object({
    path: z.string().describe('The path to the audio file to play'),
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      message: z.string(),
      success: z.boolean(),
      path: z.string().optional()
    })
  }),
  execute: async ({ context: { path: audioPath } }) => {
    try {
      const absolutePath = path.resolve(process.cwd(), audioPath);
      
      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          isError: true,
          content: {
            message: `Audio file not found at path: ${audioPath}`,
            success: false,
            path: audioPath
          }
        };
      }

      // Check file format
      const ext = path.extname(absolutePath).toLowerCase();
      if (!SUPPORTED_FORMATS.includes(ext)) {
        return {
          isError: true,
          content: {
            message: `Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
            success: false,
            path: audioPath
          }
        };
      }

      // Play the audio file
      const soundPromise = sound.play(absolutePath);
      
      // Set a timeout to ensure the sound handle is cleaned up
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(resolve, 1000); // Wait 1 second for the sound to start
      });
      
      // Wait for either the sound to finish or the timeout
      await Promise.race([soundPromise, timeoutPromise]);

      return {
        isError: false,
        content: {
          message: `Playing audio file: ${audioPath}`,
          success: true,
          path: audioPath
        }
      };
    } catch (error) {
      return {
        isError: true,
        content: {
          message: `Error playing audio: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          path: audioPath
        }
      };
    }
  }
}); 