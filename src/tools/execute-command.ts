import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const executeCommandTool = new Tool({
  id: 'execute-command',
  description: "Execute a shell command and return its output. Use with caution as this can run arbitrary commands.",
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
    cwd: z.string().optional().describe('Working directory for command execution'),
    timeout: z.number().optional().describe('Timeout in milliseconds')
  }),
  outputSchema: z.object({
    isError: z.boolean(),
    content: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable()
    })
  }),
  execute: async ({ context: { command, cwd = process.cwd(), timeout = 30000 } }) => {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return {
        isError: false,
        content: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as any;
        return {
          isError: true,
          content: {
            stdout: execError.stdout?.trim() || '',
            stderr: execError.stderr?.trim() || error.message,
            exitCode: execError.code || 1
          }
        };
      }
      return {
        isError: true,
        content: {
          stdout: '',
          stderr: String(error),
          exitCode: 1
        }
      };
    }
  }
}); 