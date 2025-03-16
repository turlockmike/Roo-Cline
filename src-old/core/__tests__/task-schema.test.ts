import { z } from 'zod';
import { Task, createStringTask } from '../task';
import { MockLanguageModelV1 } from 'ai/test';
import { createAgent } from '../agent';

describe('Task Schema Validation', () => {
  // Create a mock agent for testing
  const mockAgent = createAgent({
    name: 'Test Agent',
    role: 'Test role',
    description: 'Test description',
    model: new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async (options: any) => {
        // If schema is provided, return a valid JSON object
        if (options.mode?.type === 'object-json') {
          const input = JSON.parse(options.prompt[options.prompt.length - 1].content[0].text);
          return {
            text: JSON.stringify(input),
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          };
        }
        // For text mode, return the processed input
        const input = options.prompt[options.prompt.length - 1].content[0].text;
        return {
          text: `Processed: ${input}`,
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} }
        };
      }
    })
  });

  describe('Input Schema Validation', () => {
    it('should use string schema by default', async () => {
      const task = createStringTask({
        name: 'default-schema-task',
        description: 'Task with default string input schema',
        agent: mockAgent,
        task: (input) => `${input}`
      });

      // Valid string input
      await expect(task.run('hello')).resolves.toBe('Processed: hello');

      // Invalid input (non-string)
      await expect(task.run(123 as any)).rejects.toThrow();
    });

    it('should validate input against custom schema', async () => {
      interface UserInput {
        name: string;
        age: number;
      }

      const userSchema = z.object({
        name: z.string().min(1),
        age: z.number().min(0)
      }).strict() as z.ZodType<UserInput>;

      const task = new Task<UserInput>({
        name: 'user-task',
        description: 'Task with user input schema',
        agent: mockAgent,
        inputSchema: userSchema,
        task: (input) => `User ${input.name} is ${input.age} years old`
      });

      // Valid input
      const result = await task.run({
        name: 'John',
        age: 30
      });
      expect(result).toBe('Processed: User John is 30 years old');

      // Invalid input: empty name
      await expect(task.run({
        name: '',
        age: 30
      })).rejects.toThrow();

      // Invalid input: negative age
      await expect(task.run({
        name: 'John',
        age: -1
      })).rejects.toThrow();
    });

    it('should format task prompt with validated input', async () => {
      interface UserInput {
        name: string;
        role: 'admin' | 'user';
        action: string;
      }

      const userSchema = z.object({
        name: z.string(),
        role: z.enum(['admin', 'user']),
        action: z.string()
      }).strict() as z.ZodType<UserInput>;

      const task = new Task<UserInput>({
        name: 'format-task',
        description: 'Task with formatted prompt',
        agent: mockAgent,
        inputSchema: userSchema,
        task: (input) => `User ${input.name} with role ${input.role} wants to ${input.action}`
      });

      const result = await task.run({
        name: 'John',
        role: 'admin',
        action: 'create a new project'
      });

      expect(result).toBe('Processed: User John with role admin wants to create a new project');
    });

    it('should handle both input and output schemas', async () => {
      interface UserInput {
        name: string;
        role: 'admin' | 'user';
      }

      interface TaskOutput {
        success: boolean;
        message: string;
      }

      const userSchema = z.object({
        name: z.string(),
        role: z.enum(['admin', 'user'])
      }).strict() as z.ZodType<UserInput>;

      const outputSchema = z.object({
        success: z.boolean(),
        message: z.string()
      }).strict() as z.ZodType<TaskOutput>;

      const task = new Task<UserInput, TaskOutput>({
        name: 'schema-task',
        description: 'Task with both input and output schemas',
        agent: mockAgent,
        inputSchema: userSchema,
        outputSchema: outputSchema,
        task: (input) => `Process request from ${input.name} (${input.role})`
      });

      // Mock agent should return valid output schema
      const mockAgentWithOutput = createAgent({
        name: 'Test Agent',
        role: 'Test role',
        description: 'Test description',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: JSON.stringify({
              success: true,
              message: 'Request processed successfully'
            }),
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        })
      });

      const taskWithMockOutput = new Task<UserInput, TaskOutput>({
        name: 'schema-task',
        description: 'Task with both input and output schemas',
        agent: mockAgentWithOutput,
        inputSchema: userSchema,
        outputSchema: outputSchema,
        task: (input) => `Process request from ${input.name} (${input.role})`
      });

      const result = await taskWithMockOutput.run({
        name: 'John',
        role: 'admin'
      });

      expect(result).toEqual({
        success: true,
        message: 'Request processed successfully'
      });
    });
  });

  describe('Output Schema Validation', () => {
    it('should validate output against schema', async () => {
      interface CountOutput {
        count: number;
      }

      const outputSchema = z.object({
        count: z.number().min(0)
      }).strict() as z.ZodType<CountOutput>;

      const task = createStringTask<CountOutput>({
        name: 'output-schema-task',
        description: 'Task with output schema',
        agent: mockAgent,
        outputSchema: outputSchema,
        task: (input) => `Count words in: ${input}`
      });

      // Mock agent returns invalid output
      const mockAgentWithInvalidOutput = createAgent({
        name: 'Test Agent',
        role: 'Test role',
        description: 'Test description',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async () => ({
            text: JSON.stringify({ count: -1 }), // Invalid: negative count
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        })
      });

      const taskWithInvalidOutput = createStringTask<CountOutput>({
        name: 'output-schema-task',
        description: 'Task with output schema',
        agent: mockAgentWithInvalidOutput,
        outputSchema: outputSchema,
        task: (input) => `Count words in: ${input}`
      });

      await expect(taskWithInvalidOutput.run('test input')).rejects.toThrow();
    });
  });
});