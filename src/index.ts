import { Mastra } from '@mastra/core/mastra'
import { createLogger } from '@mastra/core/logger'
import { weatherWorkflow } from './workflows'
import { openrouterCodingAgent } from './agents'

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { openrouterCodingAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
