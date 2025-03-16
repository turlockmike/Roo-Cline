import { createWorkflow, type Workflow, type WorkflowConfig, type TaskExecutor } from '../../'
import { z } from 'zod'
import { createAgent } from '../../agent'
import { createTask } from '../../task'
import { MockLanguageModelV1 } from 'ai/test'

describe('Workflow', () => {
  // Test schemas
  const analysisSchema = z.object({
    complexity: z.number().min(1).max(10),
    changedFiles: z.array(z.string()),
  })

  const securitySchema = z.object({
    vulnerabilities: z.array(z.string()),
    riskLevel: z.enum(['high', 'medium', 'low']),
  })

  // Input/Output schemas
  const workflowInputSchema = z.object({
    diff: z.string(),
    branch: z.string().optional(),
  })

  const workflowOutputSchema = z.object({
    analysis: analysisSchema,
    security: securitySchema.optional(),
  })

  // Mock task responses
  const mockAnalysisResponse = {
    complexity: 5,
    changedFiles: ['test.ts'],
  }

  const mockSecurityResponse = {
    vulnerabilities: [],
    riskLevel: 'low' as const,
  }

  // Create a mock agent for our tasks
  const mockAgent = createAgent({
    name: 'Mock Agent',
    description: 'A mock agent for testing',
    role: 'You are a mock agent for testing',
    model: new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => ({
        text: JSON.stringify(mockAnalysisResponse),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    }),
  })

  // Create proper Task instances
  const analyzeCodeTask = createTask({
    name: 'Analyze Code',
    description: 'Analyzes code changes',
    agent: mockAgent,
    outputSchema: analysisSchema,
    task: (input: z.infer<typeof workflowInputSchema>) => `Analyze this code: ${input.diff}`,
  })

  const securityCheckTask = createTask({
    name: 'Security Check',
    description: 'Checks for security issues',
    agent: mockAgent,
    outputSchema: securitySchema,
    task: (input: { diff: string; complexity: number }) =>
      `Check security for: ${input.diff} with complexity ${input.complexity}`,
  })

  // Create task executor wrappers that match the TaskExecutor interface
  const analyzeCode = jest.fn(
    async (input: z.infer<typeof workflowInputSchema>) => mockAnalysisResponse,
  ) as jest.MockedFunction<TaskExecutor<z.infer<typeof workflowInputSchema>, typeof mockAnalysisResponse>>

  type SecurityCheckInput = { diff: string; complexity?: number }
  type SecurityCheckOutput = z.infer<typeof securitySchema>

  const securityCheck = jest.fn(async (input: SecurityCheckInput) => mockSecurityResponse) as jest.MockedFunction<
    TaskExecutor<SecurityCheckInput, SecurityCheckOutput>
  >

  // Event tracking
  type WorkflowEvent = {
    type: 'taskStart' | 'taskComplete' | 'workflowStart' | 'workflowComplete' | 'error'
    taskName?: string
    workflowName?: string
    timestamp: number
    data?: unknown
  }

  let eventLog: WorkflowEvent[]

  beforeEach(() => {
    // Reset mock function calls and event log before each test
    jest.clearAllMocks()
    eventLog = []
    analyzeCode.mockClear()
    securityCheck.mockClear()
  })

  describe('createWorkflow', () => {
    test('should create a workflow with schema validation', () => {
      const workflow = createWorkflow(
        {
          name: 'Test Workflow',
          description: 'A test workflow',
        },
        async w => ({
          analysis: mockAnalysisResponse,
          security: mockSecurityResponse,
        }),
      )

      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Test Workflow')
      expect(workflow.description).toBe('A test workflow')
    })

    test('should throw error if output fails schema validation', async () => {
      const workflow = createWorkflow(
        {
          name: 'Validated Workflow',
          description: 'A workflow with output validation',
        },
        async w => ({} as any),
      )

      await expect(workflow.run({ diff: 'test' }, { outputSchema: workflowOutputSchema })).rejects.toThrow(
        'Validation error',
      )
    })
  })

  describe('workflow events', () => {
    test('should emit events for workflow lifecycle', async () => {
      const workflow = createWorkflow<{ diff: string }>(
        {
          name: 'Event Workflow',
          description: 'A workflow that emits events',
          onTaskStart: (taskName: string) => {
            eventLog.push({
              type: 'taskStart',
              taskName,
              timestamp: Date.now(),
            })
          },
          onTaskComplete: (taskName: string, result: unknown) => {
            eventLog.push({
              type: 'taskComplete',
              taskName,
              timestamp: Date.now(),
              data: result,
            })
          },
          onWorkflowStart: (workflowName: string, input: unknown) => {
            eventLog.push({
              type: 'workflowStart',
              workflowName,
              timestamp: Date.now(),
              data: input,
            })
          },
          onWorkflowComplete: (workflowName: string, output: unknown) => {
            eventLog.push({
              type: 'workflowComplete',
              workflowName,
              timestamp: Date.now(),
              data: output,
            })
          },
        },
        async w => {
          const analysis = await w.task('Analyze Code', analyzeCode, { diff: 'test code' })
          const security = await w.task('Security Check', securityCheck, {
            diff: 'test code',
            complexity: analysis.complexity,
          })
          return {
            analysis,
            security,
          }
        },
      )

      await workflow.run({ diff: 'test code' })

      expect(eventLog).toHaveLength(6)
      expect(eventLog[0]).toMatchObject({
        type: 'workflowStart',
        workflowName: 'Event Workflow',
      })
      expect(eventLog[1]).toMatchObject({
        type: 'taskStart',
        taskName: 'Analyze Code',
      })
      expect(eventLog[2]).toMatchObject({
        type: 'taskComplete',
        taskName: 'Analyze Code',
        data: mockAnalysisResponse,
      })
      expect(eventLog[3]).toMatchObject({
        type: 'taskStart',
        taskName: 'Security Check',
      })
      expect(eventLog[4]).toMatchObject({
        type: 'taskComplete',
        taskName: 'Security Check',
        data: mockSecurityResponse,
      })
      expect(eventLog[5]).toMatchObject({
        type: 'workflowComplete',
        workflowName: 'Event Workflow',
        data: {
          analysis: mockAnalysisResponse,
          security: mockSecurityResponse,
        },
      })
    })

    test('should emit error event on failure', async () => {
      const workflow = createWorkflow(
        {
          name: 'Error Workflow',
          description: 'A workflow that fails',
          onError: (error: Error) => {
            eventLog.push({
              type: 'error',
              timestamp: Date.now(),
              data: error,
            })
          },
        },
        async w => {
          throw new Error('Task failed')
        },
      )

      await expect(workflow.run({ diff: 'test' })).rejects.toThrow("Workflow 'Error Workflow' failed: Task failed")

      expect(eventLog).toHaveLength(1)
      expect(eventLog[0]).toMatchObject({
        type: 'error',
        data: new Error("Workflow 'Error Workflow' failed: Task failed"),
      })
    })
  })

  describe('workflow execution', () => {
    test('should execute tasks in sequence', async () => {
      const workflow = createWorkflow<{ diff: string }>(
        {
          name: 'Code Review',
          description: 'Reviews code changes',
        },
        async w => {
          const analysisResult = await w.task('Analyze Code', analyzeCode, { diff: 'test code changes' })

          const securityResult = await w.task('Security Check', securityCheck, {
            diff: 'test code changes',
            complexity: analysisResult.complexity,
          })

          return {
            analysis: analysisResult,
            security: securityResult,
          }
        },
      )

      const testInput = { diff: 'test code changes' }
      const result = await workflow.run(testInput)

      // Verify task execution order
      expect(analyzeCode).toHaveBeenCalledWith(testInput)
      expect(securityCheck).toHaveBeenCalledWith({
        diff: testInput.diff,
        complexity: mockAnalysisResponse.complexity,
      })

      // Verify result structure
      expect(result).toEqual({
        analysis: mockAnalysisResponse,
        security: mockSecurityResponse,
      })
    })

    test('should execute tasks in parallel when possible', async () => {
      const workflow = createWorkflow<{ diff: string }>(
        {
          name: 'Parallel Review',
          description: 'Reviews code changes in parallel',
        },
        async w => {
          type Analysis = typeof mockAnalysisResponse
          type Security = typeof mockSecurityResponse

          const tasks = [
            {
              name: 'Analyze Code',
              task: analyzeCode,
              input: { diff: 'test code changes' },
            },
            {
              name: 'Security Check',
              task: securityCheck,
              input: {
                diff: 'test code changes',
                complexity: 5,
              },
            },
          ] as const

          const [analysisResult, securityResult] = await w.parallel(tasks)

          return {
            analysis: analysisResult,
            security: securityResult,
          }
        },
      )

      const testInput = { diff: 'test code changes' }
      const result = await workflow.run(testInput)

      // Verify both tasks were called
      expect(analyzeCode).toHaveBeenCalledWith(testInput)
      expect(securityCheck).toHaveBeenCalledWith({
        diff: testInput.diff,
        complexity: 5,
      })

      // Verify result structure
      expect(result).toEqual({
        analysis: mockAnalysisResponse,
        security: mockSecurityResponse,
      })
    })

    test('should handle task failures gracefully', async () => {
      const error = new Error('Task failed')
      const failingTask = {
        name: 'Failing Task',
        description: 'A task that fails',
        execute: jest.fn().mockRejectedValue(error),
      }

      const workflow = createWorkflow(
        {
          name: 'Failing Workflow',
          description: 'A workflow that handles failures',
        },
        async w => {
          await w.task('Failing Task', failingTask.execute, { data: 'test input' })
          return {}
        },
      )

      await expect(
        workflow.run({
          data: 'test input',
        }),
      ).rejects.toThrow(`Workflow 'Failing Workflow' failed: Task 'Failing Task' failed: ${error.message}`)

      expect(failingTask.execute).toHaveBeenCalledTimes(1)
    })

    test('should support conditional task execution', async () => {
      type AnalysisResult = typeof mockAnalysisResponse
      type SecurityResult = typeof mockSecurityResponse

      const workflow = createWorkflow<{ diff: string }>(
        {
          name: 'Conditional Workflow',
          description: 'A workflow with conditional execution',
        },
        async w => {
          const analysis = await w.task('Analyze Code', analyzeCode, { diff: 'test code' })

          let security = null
          if (analysis.complexity > 7) {
            security = await w.task('Security Check', securityCheck, {
              diff: 'test code',
              complexity: analysis.complexity,
            })
          }

          return {
            analysis,
            ...(security ? { security } : {}),
          }
        },
      )

      // Test with low complexity
      analyzeCode.mockResolvedValueOnce({ ...mockAnalysisResponse, complexity: 5 })
      let result = await workflow.run({ diff: 'simple change' })
      expect(result).toEqual({
        analysis: { ...mockAnalysisResponse, complexity: 5 },
      })
      expect(securityCheck).not.toHaveBeenCalled()

      // Test with high complexity
      analyzeCode.mockResolvedValueOnce({ ...mockAnalysisResponse, complexity: 8 })
      result = await workflow.run({ diff: 'complex change' })
      expect(result).toEqual({
        analysis: { ...mockAnalysisResponse, complexity: 8 },
        security: mockSecurityResponse,
      })
      expect(securityCheck).toHaveBeenCalledWith({
        diff: 'test code',
        complexity: 8,
      })
    })

    test('should provide access to workflow input values', async () => {
      // Define a workflow with structured input
      interface TestInput {
        value1: number
        value2: number
        operation: 'add' | 'multiply'
      }

      const testInput: TestInput = {
        value1: 5,
        value2: 3,
        operation: 'multiply',
      }

      // Mock task that uses input values
      const calculateResult = jest.fn().mockImplementation(async (input: { a: number; b: number }) => {
        return input.a * input.b
      })

      const workflow = createWorkflow<TestInput>(
        {
          name: 'Input Access Test',
          description: 'Tests access to workflow input values',
        },
        async w => {
          // Verify that input values are accessible
          expect(w.input).toBeDefined()
          expect(w.input.value1).toBe(testInput.value1)
          expect(w.input.value2).toBe(testInput.value2)
          expect(w.input.operation).toBe(testInput.operation)

          // Use the input values in a task
          const result = await w.task('Calculate', calculateResult, { a: w.input.value1, b: w.input.value2 })

          return { result }
        },
      )

      const result = await workflow.run(testInput)

      // Verify the task was called with correct input values
      expect(calculateResult).toHaveBeenCalledWith({
        a: testInput.value1,
        b: testInput.value2,
      })

      // Verify the result
      expect(result).toEqual({ result: 15 }) // 5 * 3 = 15
    })
  })

  describe('proposed workflow pattern', () => {
    test('should support parallel execution with dependencies and success states', async () => {
      // Define task schemas
      const prAnalysisSchema = z.object({
        title: z.string(),
        description: z.string(),
        changedFiles: z.array(z.string()),
        complexity: z.number().min(1).max(10),
      })

      const securitySchema = z.object({
        vulnerabilities: z.array(z.string()),
        riskLevel: z.enum(['high', 'medium', 'low']),
        recommendations: z.array(z.string()),
      })

      const testPlanSchema = z.object({
        testCases: z.array(z.string()),
        coverage: z.number().min(0).max(100),
        estimatedTime: z.number(),
      })

      // Mock task responses
      const mockPRAnalysis = {
        title: 'Test PR',
        description: 'Test description',
        changedFiles: ['test.ts'],
        complexity: 5,
      }

      const mockSecurityCheck = {
        vulnerabilities: [],
        riskLevel: 'low' as const,
        recommendations: ['No issues found'],
      }

      const mockTestPlan = {
        testCases: ['Test case 1'],
        coverage: 90,
        estimatedTime: 30,
      }

      // Mock tasks
      const analyzePR = {
        name: 'Analyze PR',
        execute: jest.fn().mockResolvedValue(mockPRAnalysis),
      }

      const securityCheck = {
        name: 'Security Check',
        execute: jest.fn().mockResolvedValue(mockSecurityCheck),
      }

      const generateTestPlan = {
        name: 'Generate Test Plan',
        execute: jest.fn().mockResolvedValue(mockTestPlan),
      }

      // Define workflow output type
      type WorkflowOutput = {
        analysis: typeof mockPRAnalysis
        security: typeof mockSecurityCheck
        testPlan: typeof mockTestPlan
      }

      // Create workflow
      const workflow = createWorkflow<{ diff: string }>(
        {
          name: 'Comprehensive PR Review',
          description: 'Reviews a pull request and generates a test plan',
        },
        async w => {
          // Execute initial tasks in parallel
          const results = await w.parallel([
            {
              name: 'PR Analysis',
              task: analyzePR.execute,
              input: { diff: 'test code' },
            },
            {
              name: 'Security Check',
              task: securityCheck.execute,
              input: { diff: 'test code', complexity: 5 },
            },
          ])

          const [prAnalysis, securityResults] = results as [typeof mockPRAnalysis, typeof mockSecurityCheck]

          // Handle security check result
          if (securityResults.riskLevel === 'low') {
            // Execute test plan task directly
            const testPlanResult = await generateTestPlan.execute({
              diff: 'test code',
              vulnerabilities: [],
            })

            // Return final result with all required fields
            return w.success({
              analysis: prAnalysis,
              security: securityResults,
              testPlan: testPlanResult,
            })
          }

          return w.fail('Security check failed')
        },
      )

      // Execute workflow
      const result = await workflow.run(
        { diff: 'test code' },
        {
          outputSchema: z
            .object({
              analysis: prAnalysisSchema.extend({}).passthrough(),
              security: securitySchema
                .extend({
                  recommendations: z.array(z.string()),
                })
                .passthrough(),
              testPlan: testPlanSchema.extend({}).passthrough(),
            })
            .transform(
              (val): WorkflowOutput => ({
                analysis: val.analysis as typeof mockPRAnalysis,
                security: val.security as typeof mockSecurityCheck,
                testPlan: val.testPlan as typeof mockTestPlan,
              }),
            ),
        },
      )

      // Verify parallel execution
      expect(analyzePR.execute).toHaveBeenCalledWith({ diff: 'test code' })
      expect(securityCheck.execute).toHaveBeenCalledWith({
        diff: 'test code',
        complexity: 5,
      })

      // Verify conditional execution
      expect(generateTestPlan.execute).toHaveBeenCalledWith({
        diff: 'test code',
        vulnerabilities: [],
      })

      // Verify final result
      expect(result).toEqual({
        analysis: mockPRAnalysis,
        security: mockSecurityCheck,
        testPlan: mockTestPlan,
      })
    })
  })
})
