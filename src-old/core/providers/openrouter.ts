import { createOpenRouter, LanguageModelV1 } from "@openrouter/ai-sdk-provider";

export async function createOpenRouterProvider (apiKey?: string) {
    const openrouter = await createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY
    });
    return openrouter;
}

export async function createOpenRouterModel(model: string = 'google/gemini-2.0-flash-lite-001', apiKey?: string): Promise<LanguageModelV1> {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
        throw new Error('OPENROUTER_API_KEY is not set');
    }
    const openrouter = await createOpenRouterProvider(key);
    return openrouter(model);
  }; 