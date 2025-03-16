import { z } from 'zod';
import { Task } from '../../task';
import { Agent } from '../../agent';
import { TaskToolAdapter } from '../../mcp/server/task-tool-adapter';
import { createAgent } from '../../agent';
import { McpError, ErrorCode } from '../../mcp/types';
import { LanguageModelV1 } from 'ai';

// Mock implementation of LanguageModelV1
const mockModel: jest.Mocked<LanguageModelV1> = {
  provider: 'test',
  specificationVersion: 'v1',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
  doGenerate: jest.fn(),
  doStream: jest.fn()
};

describe('TaskToolAdapter', () => {
  let mockAgent: Agent;
  let mockAgentTask: jest.SpyInstance;
  
  beforeEach(() => {
    // Setup mock agent
    mockAgent = createAgent({
      name: 'test-agent',
      description: 'Test agent',
      role: 'test role',
      model: mockModel
    });

    mockAgentTask = jest.spyOn(mockAgent, 'task');
    mockAgentTask.mockImplementation(async () => 'test response');

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('generateParameters', () => {
    it('should handle string schema as content parameter', () => {
      const task = new Task<string>({
        name: 'string-task',
        description: 'Task with string input',
        agent: mockAgent,
        task: 'test',
        inputSchema: z.string()
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'string',
          description: 'Input content'
        }
      });
    });

    it('should handle number schema as content parameter', () => {
      const task = new Task<number>({
        name: 'number-task',
        description: 'Task with number input',
        agent: mockAgent,
        task: 'test',
        inputSchema: z.number()
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'number',
          description: 'Input content'
        }
      });
    });

    it('should handle boolean schema as content parameter', () => {
      const task = new Task<boolean>({
        name: 'boolean-task',
        description: 'Task with boolean input',
        agent: mockAgent,
        task: 'test',
        inputSchema: z.boolean()
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'boolean',
          description: 'Input content'
        }
      });
    });

    it('should handle array schema as content parameter', () => {
      const task = new Task<string[]>({
        name: 'array-task',
        description: 'Task with array input',
        agent: mockAgent,
        task: 'test',
        inputSchema: z.array(z.string())
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Input content'
        }
      });
    });

    it('should handle enum schema as content parameter with enum values', () => {
      const task = new Task<'red' | 'blue' | 'green'>({
        name: 'enum-task',
        description: 'Task with enum input',
        agent: mockAgent,
        task: 'test',
        inputSchema: z.enum(['red', 'blue', 'green'])
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'string',
          enum: ['red', 'blue', 'green'],
          description: 'Input content'
        }
      });
    });

    it('should handle object schema as direct parameters', () => {
      const inputSchema = z.object({
        name: z.string(),
        age: z.number(),
        isActive: z.boolean()
      });

      const task = new Task<z.infer<typeof inputSchema>>({
        name: 'object-task',
        description: 'Task with object input',
        agent: mockAgent,
        task: 'test',
        inputSchema
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        name: { type: 'string' },
        age: { type: 'number' },
        isActive: { type: 'boolean' }
      });
    });

    it('should preserve parameter descriptions from input schema', () => {
      const inputSchema = z.object({
        name: z.string().describe('The user\'s full name'),
        age: z.number().describe('The user\'s age in years'),
        settings: z.object({
          theme: z.enum(['light', 'dark']).describe('UI theme preference'),
          notifications: z.boolean().describe('Whether notifications are enabled')
        }).describe('User preferences')
      });

      const task = new Task<z.infer<typeof inputSchema>>({
        name: 'described-params-task',
        description: 'Task with described parameters',
        agent: mockAgent,
        task: 'test',
        inputSchema
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        name: { 
          type: 'string',
          description: 'The user\'s full name'
        },
        age: { 
          type: 'number',
          description: 'The user\'s age in years'
        },
        settings: {
          type: 'object',
          description: 'User preferences',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              description: 'UI theme preference'
            },
            notifications: {
              type: 'boolean',
              description: 'Whether notifications are enabled'
            }
          }
        }
      });
    });

    it('should handle nested object schema as nested parameters', () => {
      const inputSchema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
          address: z.object({
            street: z.string(),
            city: z.string()
          })
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean()
        })
      });

      const task = new Task<z.infer<typeof inputSchema>>({
        name: 'nested-object-task',
        description: 'Task with nested object input',
        agent: mockAgent,
        task: 'test',
        inputSchema
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' }
              }
            }
          }
        },
        settings: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark']
            },
            notifications: { type: 'boolean' }
          }
        }
      });
    });

    it('should handle string task with no schema as content parameter', () => {
      const task = new Task({
        name: 'no-schema-task',
        description: 'Task with no schema',
        agent: mockAgent,
        task: 'test'
      });

      const adapter = new TaskToolAdapter();
      const params = adapter.generateParameters(task);

      expect(params).toEqual({
        content: {
          type: 'string',
          description: 'Input content'
        }
      });
    });
  });

  it('should convert basic task to MCP tool', async () => {
    const task = new Task({
      name: 'test-task',
      description: 'A test task',
      agent: mockAgent,
      task: 'test prompt'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    expect(tool.name).toBe('test-task');
    expect(tool.description).toBe('A test task');
    expect(tool.parameters).toEqual({
      content: {
        type: 'string',
        description: 'Input content'
      }
    });
  });

  it('should convert task with input schema to MCP tool', async () => {
    const inputSchema = z.object({
      message: z.string(),
      count: z.number()
    });

    const task = new Task<z.infer<typeof inputSchema>>({
      name: 'schema-task',
      description: 'Task with schema',
      agent: mockAgent,
      task: (input) => `Process ${input.message} ${input.count} times`,
      inputSchema: inputSchema
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    expect(tool.parameters).toMatchObject({
      message: { type: 'string' },
      count: { type: 'number' }
    });
  });

  it('should handle task execution as a tool', async () => {
    const expectedResponse = 'test response';
    mockAgentTask.mockResolvedValueOnce(expectedResponse);

    const task = new Task<string>({
      name: 'exec-task',
      description: 'Executable task',
      agent: mockAgent,
      task: (input) => `Process ${input} times`
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    const result = await tool.execute({} as any);
    expect(result.raw.content).toHaveLength(1);
    expect(result.raw.content[0].type).toBe('text');
    expect(result.raw.content[0].text).toBe(expectedResponse);
    expect(result.data).toBe(expectedResponse);
  });

  it('should handle task execution errors', async () => {
    const errorMessage = 'Task failed';
    mockAgentTask.mockRejectedValue(new Error(errorMessage));

    const task = new Task<string>({
      name: 'error-task',
      description: 'Error task',
      agent: mockAgent,
      task: 'test error'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    await expect(tool.execute({} as any)).rejects.toThrow(McpError);
    await expect(tool.execute({} as any)).rejects.toThrow(errorMessage);
  });

  it('should preserve task output schema in tool response', async () => {
    const outputSchema = z.object({
      result: z.string(),
      timestamp: z.number()
    });

    const mockOutput = {
      result: 'test',
      timestamp: 123
    };

    mockAgentTask.mockResolvedValueOnce(mockOutput);

    const task = new Task<unknown, z.infer<typeof outputSchema>>({
      name: 'output-schema-task',
      description: 'Task with output schema',
      agent: mockAgent,
      task: 'test output schema',
      outputSchema: outputSchema
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    const result = await tool.execute({});
    expect(result.raw.content[0].text).toBe(JSON.stringify(mockOutput));
    expect(result.data).toEqual(mockOutput);
  });

  it('should handle nested object schemas in tool parameters', async () => {
    const inputSchema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string()
        })
      }),
      settings: z.object({
        notifications: z.boolean(),
        theme: z.enum(['light', 'dark'])
      })
    });

    const task = new Task<z.infer<typeof inputSchema>>({
      name: 'nested-schema-task',
      description: 'Task with nested schema',
      agent: mockAgent,
      task: (input) => `Process user ${input.user.name} with theme ${input.settings.theme}`,
      inputSchema: inputSchema
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    expect(tool.parameters).toMatchObject({
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' }
            }
          }
        }
      },
      settings: {
        type: 'object',
        properties: {
          notifications: { type: 'boolean' },
          theme: {
            type: 'string',
            enum: ['light', 'dark']
          }
        }
      }
    });
  });
});