import { Agent } from '../../agent'
import { MockLanguageModelV1 } from 'ai/test'
import { createCodeAnalysisTask, createBugAnalysisTask, createPRReviewTask, createRefactoringPlanTask } from '../index'

describe('Predefined Tasks', () => {
  let agent: Agent

  beforeEach(() => {
    agent = new Agent({
      name: 'Test Agent',
      description: 'A test agent',
      role: 'test',
      model: new MockLanguageModelV1({
        defaultObjectGenerationMode: 'json',
        doGenerate: async () => ({
          text: JSON.stringify({
            summary: 'Test summary',
            complexity: 5,
            suggestions: ['Suggestion 1', 'Suggestion 2'],
            risks: ['Risk 1', 'Risk 2'],
            rootCause: 'Test root cause',
            severity: 'medium',
            suggestedFix: 'Test fix',
            preventionTips: ['Tip 1', 'Tip 2'],
            changes: [
              {
                file: 'test.ts',
                impact: 'medium',
                suggestions: ['Suggestion 1'],
              },
            ],
            overallImpact: 'Medium impact',
            testingSuggestions: ['Test suggestion 1'],
            goals: ['Goal 1'],
            steps: [
              {
                description: 'Step 1',
                effort: 'medium',
                risks: ['Risk 1'],
              },
            ],
            testingStrategy: 'Test strategy',
          }),
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      }),
    })
  })

  describe('Code Analysis Task', () => {
    it('should analyze code and provide structured feedback', async () => {
      const task = createCodeAnalysisTask(agent)
      const result = await task.run('function test() { console.log("test"); }')

      expect(result).toEqual({
        summary: 'Test summary',
        complexity: 5,
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        risks: ['Risk 1', 'Risk 2'],
      })
    })
  })

  describe('Bug Analysis Task', () => {
    it('should analyze bug reports and provide solutions', async () => {
      const task = createBugAnalysisTask(agent)
      const result = await task.run('function test() { console.log("test"); }')

      expect(result).toEqual({
        rootCause: 'Test root cause',
        severity: 'medium',
        suggestedFix: 'Test fix',
        preventionTips: ['Tip 1', 'Tip 2'],
      })
    })
  })

  describe('PR Review Task', () => {
    it('should review pull requests and provide feedback', async () => {
      const task = createPRReviewTask(agent)
      const result = await task.run('function test() { console.log("test"); }')

      expect(result).toEqual({
        summary: 'Test summary',
        changes: [
          {
            file: 'test.ts',
            impact: 'medium',
            suggestions: ['Suggestion 1'],
          },
        ],
        overallImpact: 'Medium impact',
        testingSuggestions: ['Test suggestion 1'],
      })
    })
  })

  describe('Refactoring Plan Task', () => {
    it('should create a structured refactoring plan', async () => {
      const task = createRefactoringPlanTask(agent)
      const result = await task.run('function test() { console.log("test"); }')

      expect(result).toEqual({
        goals: ['Goal 1'],
        steps: [
          {
            description: 'Step 1',
            effort: 'medium',
            risks: ['Risk 1'],
          },
        ],
        testingStrategy: 'Test strategy',
      })
    })
  })
})
