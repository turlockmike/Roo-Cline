import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent-runtime'

export interface KnowledgeBaseConfig {
  region?: string
  knowledgeBaseId: string
  modelArn?: string
  profile?: string
}

export interface KnowledgeBaseResponse {
  content: string
  metadata?: Record<string, unknown>
  sources?: Array<{
    url?: string
    title?: string
    content?: string
    metadata?: Record<string, unknown>
    sourceType?: string
  }>
}

export async function createKnowledgeBaseProvider(
  client: BedrockAgentRuntimeClient,
  config?: Partial<KnowledgeBaseConfig>,
) {
  // Default configuration values
  const defaultConfig: Partial<KnowledgeBaseConfig> = {
    modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0',
    region: 'us-east-1',
  }

  // Merge provided config with defaults
  const effectiveConfig: Partial<KnowledgeBaseConfig> = {
    ...defaultConfig,
    ...config,
  }

  // Validate that knowledgeBaseId is provided
  if (!effectiveConfig.knowledgeBaseId) {
    throw new Error(
      'Knowledge Base ID is required. Please provide it via CLI (--kb-id), environment variable (KB_ID), or in your profile configuration.',
    )
  }

  return async function query(text: string) {
    const command = new RetrieveAndGenerateCommand({
      input: { text },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: effectiveConfig.knowledgeBaseId!,
          modelArn: effectiveConfig.modelArn,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 75,
            },
          },
        },
      },
    })

    try {
      const response = await client.send(command)

      const content = response.output?.text || ''

      // Extract source URLs from citations
      const sources =
        response.citations?.flatMap(
          citation =>
            citation.retrievedReferences?.map(reference => {
              // Get URL from web location if available
              let url = reference.location?.type === 'WEB' ? reference.location.webLocation?.url : undefined

              // Get content from the reference
              const referenceContent = reference.content?.text

              // Get source type
              const sourceType = reference.location?.type || 'UNKNOWN'

              // Include all metadata for debugging
              const allMetadata = reference.metadata ? { ...reference.metadata } : {}

              // Try to get source URI from metadata if not available from location
              if (!url && allMetadata['x-amz-bedrock-kb-source-uri']) {
                url = allMetadata['x-amz-bedrock-kb-source-uri'] as string
              }

              // Get document title from metadata if available
              const docTitle = (allMetadata['x-amz-bedrock-kb-title'] as string) || undefined

              return {
                url,
                title: docTitle || `${sourceType} Document`,
                content: referenceContent,
                metadata: allMetadata,
                sourceType,
              }
            }) || [],
        ) || []

      return {
        content: content,
        sources,
        metadata: {
          responseId: response.$metadata.requestId,
          timestamp: response.$metadata.attempts?.[0]?.timestamp,
        },
      }
    } catch (error) {
      console.error('Error querying knowledge base:', error)

      // Check for specific AWS errors
      if (error instanceof Error) {
        const errorMessage = error.message

        if (errorMessage.includes('AccessDenied')) {
          return {
            content: `AWS Access Denied Error: You don't have permission to access this knowledge base. Please check your IAM policies.`,
            metadata: { error: errorMessage },
            sources: [],
          }
        }

        if (errorMessage.includes('ResourceNotFoundException')) {
          return {
            content: `Knowledge Base Not Found: The knowledge base ID '${effectiveConfig.knowledgeBaseId}' could not be found. Please verify it exists in your AWS account and region (${effectiveConfig.region}). You can specify a different knowledge base ID using the --kb-id option.`,
            metadata: { error: errorMessage },
            sources: [],
          }
        }

        if (errorMessage.includes('ValidationException')) {
          if (errorMessage.includes('knowledgeBaseId')) {
            return {
              content: `Invalid Knowledge Base ID: '${effectiveConfig.knowledgeBaseId}'. Please provide a valid knowledge base ID using the --kb-id option or KB_ID environment variable.`,
              metadata: { error: errorMessage },
              sources: [],
            }
          }
          return {
            content: `Validation Error: ${errorMessage}. This may be due to incorrect knowledge base configuration.`,
            metadata: { error: errorMessage },
            sources: [],
          }
        }

        return {
          content: `Error querying knowledge base: ${errorMessage}`,
          metadata: {
            error: errorMessage,
            stack: error.stack,
          },
          sources: [],
        }
      }

      return {
        content: 'An unknown error occurred while querying the knowledge base.',
        metadata: { error: String(error) },
        sources: [],
      }
    }
  }
}

export async function* doStream(query: (text: string) => Promise<KnowledgeBaseResponse>) {
  const response = await query('')
  yield response
}
