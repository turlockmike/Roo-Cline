import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Agent } from '@mastra/core/agent';
import { CODING_TOOLS } from '../tools';
import { getAgentRules } from '../prompts/rules';
import { getEnvironmentInfo } from '../prompts/environment';

const openRouter = createOpenRouter({
    apiKey: process.env.OPEN_ROUTER_API_KEY,
});

const model = openRouter.chat('anthropic/claude-3.7-sonnet', {

});

import { mcp } from '../tools/mcp';

export async function codingAgent(provider: 'openrouter' | 'mcp') {
    return new Agent({
        name: 'Coding Agent',
    instructions: `
        ${getAgentRules()}
        ${getEnvironmentInfo()}
    `,
    model: model,
    tools: { ...CODING_TOOLS, ...(await mcp.getTools()) },
    })
}
