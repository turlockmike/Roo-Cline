import { createOpenAI } from '@ai-sdk/openai'
import { LanguageModelV1 } from 'ai'

/**
 * Create an OpenAI provider with the given API key
 * @param apiKey OpenAI API key (optional, defaults to OPENAI_API_KEY environment variable)
 * @returns OpenAI provider
 */
export async function createOpenAIProvider(apiKey?: string) {
  const key = apiKey || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return createOpenAI({
    apiKey: key,
  })
}

/**
 * Create an OpenAI model with the given model name
 * @param model Model name (defaults to gpt-4o)
 * @param apiKey OpenAI API key (optional, defaults to OPENAI_API_KEY environment variable)
 * @returns OpenAI model
 */
export async function createOpenAIModel(model: string = 'gpt-4o', apiKey?: string): Promise<LanguageModelV1> {
  const openai = await createOpenAIProvider(apiKey)
  return openai(model)
}
