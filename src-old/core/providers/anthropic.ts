import { createAnthropic } from '@ai-sdk/anthropic'
import { LanguageModelV1 } from 'ai'

/**
 * Create an Anthropic provider with the given API key
 * @param apiKey Anthropic API key (optional, defaults to ANTHROPIC_API_KEY environment variable)
 * @returns Anthropic provider
 */
export async function createAnthropicProvider(apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return createAnthropic({
    apiKey: key,
  })
}

/**
 * Create an Anthropic model with the given model name
 * @param model Model name (defaults to claude-3-5-sonnet-20240620)
 * @param apiKey Anthropic API key (optional, defaults to ANTHROPIC_API_KEY environment variable)
 * @returns Anthropic model
 */
export async function createAnthropicModel(
  model: string = 'claude-3-5-sonnet-20240620',
  apiKey?: string,
): Promise<LanguageModelV1> {
  const anthropic = await createAnthropicProvider(apiKey)
  return anthropic(model)
}
