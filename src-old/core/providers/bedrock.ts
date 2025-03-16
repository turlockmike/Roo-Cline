import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { fromIni } from '@aws-sdk/credential-providers'

// Configure AWS SDK to use credentials from config file
process.env.AWS_SDK_LOAD_CONFIG = '1'

export async function createBedrockProvider(profile?: string) {
  process.env.AWS_PROFILE = process.env.AWS_PROFILE || profile || 'default'
  const credentials = await fromIni({ profile })()
  return createAmazonBedrock({
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  })
}

export async function createBedrockModel(
  profile: string = 'default',
  model: string = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
) {
  const bedrock = await createBedrockProvider(profile)
  return bedrock(model)
}
