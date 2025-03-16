import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime'
import { fromIni } from '@aws-sdk/credential-providers'
import { createKnowledgeBaseProvider } from '../src-old/core/providers/knowledge-base'

/**
 * This example demonstrates how to use the AWS Bedrock Knowledge Base provider.
 *
 * Prerequisites:
 * 1. You must have an AWS account with access to Amazon Bedrock
 * 2. You must have created a knowledge base in Amazon Bedrock
 * 3. You must have AWS credentials configured (via AWS CLI or environment variables)
 *
 * To run this example:
 * 1. Replace 'your-knowledge-base-id' with your actual AWS Knowledge Base ID
 * 2. Make sure you have AWS credentials configured
 * 3. Run: npx ts-node examples/knowledge-base.ts
 *
 * Alternatively, you can use environment variables:
 * KB_ID=your-kb-id AWS_PROFILE=your-profile npx ts-node examples/knowledge-base.ts
 */
async function main() {
  // Configuration - IMPORTANT: Replace these values with your own
  const config = {
    // REQUIRED: Your AWS Knowledge Base ID - this must be provided
    knowledgeBaseId: 'your-knowledge-base-id', // Replace with your actual knowledge base ID

    // Optional configurations (will use defaults if not provided)
    region: 'us-east-1', // AWS region where your knowledge base is located
    modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0', // Model to use for generation
    profile: 'default', // AWS profile name (from ~/.aws/credentials)
  }

  // Create the AWS Bedrock client
  const client = new BedrockAgentRuntimeClient({
    region: config.region,
    credentials: await fromIni({ profile: config.profile })(),
  })

  // Create a knowledge base provider instance
  const kbProvider = await createKnowledgeBaseProvider(client, {
    knowledgeBaseId: config.knowledgeBaseId, // Required - must be provided
    modelArn: config.modelArn, // Optional - will use default if not provided
    region: config.region, // Optional - will use default if not provided
  })

  try {
    // Query the knowledge base
    const response = await kbProvider('What is the capital of France?')

    // Display the response content
    console.log('Response:', response.content)

    // Display sources if available
    if (response.sources && response.sources.length > 0) {
      console.log('\nSources:')
      response.sources.forEach((source, index) => {
        console.log(`\n[${index + 1}] ${source.title || 'Untitled Source'}`)
        if (source.url) {
          console.log(`    URL: ${source.url}`)
        }
        if (source.content) {
          console.log(`    Content: ${source.content.substring(0, 100)}${source.content.length > 100 ? '...' : ''}`)
        }
      })
    } else {
      console.log('\nNo sources available for this response.')
    }

    // Display metadata
    console.log('\nMetadata:', response.metadata)
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the example
main().catch(console.error)
