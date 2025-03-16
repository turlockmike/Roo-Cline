import { z } from 'zod'
import { Agent } from '../agent'
import { createTask } from '../task'

// Schema definitions
const codeAnalysisSchema = z.object({
  summary: z.string(),
  complexity: z.number().min(1).max(10),
  suggestions: z.array(z.string()),
  risks: z.array(z.string()),
})

const bugAnalysisSchema = z.object({
  rootCause: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  suggestedFix: z.string(),
  preventionTips: z.array(z.string()),
})

const prReviewSchema = z.object({
  summary: z.string(),
  changes: z.array(
    z.object({
      file: z.string(),
      impact: z.string(),
      suggestions: z.array(z.string()),
    }),
  ),
  overallImpact: z.string(),
  testingSuggestions: z.array(z.string()),
})

const refactoringPlanSchema = z.object({
  goals: z.array(z.string()),
  steps: z.array(
    z.object({
      description: z.string(),
      effort: z.enum(['small', 'medium', 'large']),
      risks: z.array(z.string()),
    }),
  ),
  testingStrategy: z.string(),
})

// Task factory functions
export function createCodeAnalysisTask(agent: Agent) {
  return createTask({
    name: 'Analyze Code',
    description: 'Analyze code for complexity, potential issues, and improvement suggestions',
    agent,
    outputSchema: codeAnalysisSchema,
    task: (input: string) => `
            Analyze the following code and provide detailed feedback:
            
            ${input}
            
            Focus on:
            1. Code complexity and maintainability
            2. Potential issues or risks
            3. Suggestions for improvement
            4. Best practices adherence
            
            Provide a structured analysis with specific, actionable feedback.
        `,
  })
}

export function createBugAnalysisTask(agent: Agent) {
  return createTask({
    name: 'Debug Issue',
    description: 'Analyze bug reports and provide root cause analysis with fix suggestions',
    agent,
    outputSchema: bugAnalysisSchema,
    task: (input: string) => `
            Analyze the following bug report and provide a detailed analysis:
            
            Description:
            ${input}
            
            Provide:
            1. Root cause analysis
            2. Severity assessment
            3. Suggested fix with code examples if applicable
            4. Prevention tips for similar issues
        `,
  })
}

export function createPRReviewTask(agent: Agent) {
  return createTask({
    name: 'Review Pull Request',
    description: 'Review code changes and provide structured feedback',
    agent,
    outputSchema: prReviewSchema,
    task: (input: string) => `
            Review the following pull request and provide detailed feedback:
            
            PR Description:
            ${input}
            
            Provide a thorough review focusing on:
            1. Code quality and best practices
            2. Potential issues or risks
            3. Test coverage
            4. Performance implications
            5. Security considerations
            
            Structure your review to be constructive and actionable.
        `,
  })
}

export function createRefactoringPlanTask(agent: Agent) {
  return createTask({
    name: 'Plan Refactoring',
    description: 'Create a structured plan for code refactoring',
    agent,
    outputSchema: refactoringPlanSchema,
    task: (input: string) => `
            Create a refactoring plan for the following code:
            
            Code:
            ${input}
            
            Provide a detailed plan including:
            1. Clear, achievable steps
            2. Effort estimation for each step
            3. Potential risks and mitigation strategies
            4. Testing approach
            
            Focus on maintaining functionality while improving code quality.
        `,
  })
}

// Additional task types that could be implemented:
// - Documentation Generator
// - Test Case Generator
// - Performance Optimization Advisor
// - Security Audit
// - Dependency Analysis
// - API Documentation Review
// - Code Style Enforcement
// - Database Query Optimization
// - Infrastructure as Code Review
// - Accessibility Compliance Check
