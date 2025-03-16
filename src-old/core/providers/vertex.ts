import { createVertex } from '@ai-sdk/google-vertex'
import { LanguageModelV1 } from 'ai'

/**
 * Create a Google Vertex AI provider with the given configuration
 * @param project Google Cloud project ID (optional, defaults to environment variable)
 * @param location Google Cloud location (optional, defaults to 'us-central1')
 * @returns Google Vertex AI provider
 */
export async function createVertexProvider(project?: string, location: string = 'us-central1') {
  const projectId = project || process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set')
  }
  return createVertex({
    project: projectId,
    location,
  })
}

/**
 * Create a Google Vertex AI model with the given model name
 * @param model Model name (defaults to gemini-1.5-flash)
 * @param project Google Cloud project ID (optional, defaults to environment variable)
 * @param location Google Cloud location (optional, defaults to 'us-central1')
 * @returns Google Vertex AI model
 */
export async function createVertexModel(
  model: string = 'gemini-1.5-flash',
  project?: string,
  location: string = 'us-central1',
): Promise<LanguageModelV1> {
  const vertex = await createVertexProvider(project, location)
  return vertex(model)
}
