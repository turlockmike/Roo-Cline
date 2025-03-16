import { BedrockAgentRuntimeClient } from '@aws-sdk/client-bedrock-agent-runtime'
import { fromIni } from '@aws-sdk/credential-providers'
import chalk from 'chalk'
import { colors, log } from '../utils/colors'
import { PassThrough } from 'node:stream'
import { input } from '@inquirer/prompts'
import { Command } from 'commander'
import { createCLIAgent } from '../core/agents'
import { createBedrockModel } from '../core/providers/bedrock'
import { createKnowledgeBaseProvider, KnowledgeBaseConfig } from '../core/providers/knowledge-base'
import { playAudioTool } from '../core/tools/play-audio'
import { ConfigLoader, CliOptions } from '../config/config-loader'
import { ProfileManager } from '../config/profile-manager'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { LanguageModelV1, CreateMessage } from 'ai'
import { Thread } from '../core/thread/thread'

/**
 * Convert a model name to an AWS Bedrock model ARN
 * @param modelName The model name to convert
 * @param region The AWS region
 * @returns The model ARN
 */
function convertToModelArn(modelName: string, region: string = 'us-east-1'): string {
  // If already an ARN, return as is
  if (modelName.startsWith('arn:')) {
    return modelName
  }

  // Handle different model formats
  if (modelName.includes('/')) {
    // Format like "anthropic/claude-3-5-sonnet"
    const [provider, model] = modelName.split('/')
    if (provider.toLowerCase() === 'anthropic') {
      return `arn:aws:bedrock:${region}::foundation-model/anthropic.${model}:0`
    } else if (provider.toLowerCase() === 'amazon') {
      return `arn:aws:bedrock:${region}::foundation-model/amazon.${model}:0`
    } else if (provider.toLowerCase() === 'meta') {
      return `arn:aws:bedrock:${region}::foundation-model/meta.${model}:0`
    } else if (provider.toLowerCase() === 'cohere') {
      return `arn:aws:bedrock:${region}::foundation-model/cohere.${model}:0`
    } else if (provider.toLowerCase() === 'ai21') {
      return `arn:aws:bedrock:${region}::foundation-model/ai21.${model}:0`
    }
  }

  // Default to Anthropic if just a model name is provided
  return `arn:aws:bedrock:${region}::foundation-model/anthropic.${modelName}:0`
}

/**
 * Process streams from agent responses
 */
export async function processStreams(textStream: AsyncIterable<string>, options: any) {
  const consoleStream = new PassThrough()
  const sourceStream = new PassThrough()
  let fullText = '' // Collect full text for TTS

  // Convert AsyncIterable to stream
  const streamPromise = (async () => {
    try {
      for await (const chunk of textStream) {
        sourceStream.write(chunk)
      }
      sourceStream.end()
    } catch (err) {
      sourceStream.destroy(err as Error)
      throw err // Re-throw to be caught by the outer try-catch
    }
  })()

  // Pipe source to console
  sourceStream.pipe(consoleStream)

  // Set up console output with color
  consoleStream.on('data', chunk => {
    // Color the agent's output in green
    process.stdout.write(colors.success(chunk.toString()))
  })

  // Wait for both the stream processing and console output to finish
  await Promise.all([
    streamPromise,
    new Promise<void>((resolve, reject) => {
      consoleStream.on('end', resolve)
      consoleStream.on('error', reject)
    }),
  ])

  // Add a newline at the end for better formatting
  process.stdout.write('\n')
}

// Add a local interface extension for CLI options
export interface CliOptionsWithInteractive extends CliOptions {
  interactive?: boolean
}

/**
 * Execute a task with the given configuration
 */
export async function executeWithConfig(task: string, cliOptions: CliOptions, interactive?: boolean) {
  try {
    const configLoader = new ConfigLoader()
    const { profile, agent } = await configLoader.getEffectiveConfig(cliOptions)

    // Determine configuration options
    const shouldUseInteractive = interactive !== undefined ? interactive : false
    const shouldPlaySound = cliOptions.sound !== undefined ? cliOptions.sound : profile.options?.sound
    let shouldStream = cliOptions.stream !== undefined ? cliOptions.stream : profile.options?.stream
    const shouldShowVerbose = cliOptions.verbose === true

    // Determine which model to use
    let model: LanguageModelV1
    const provider = cliOptions.provider || profile.provider
    const modelName = cliOptions.model || profile.model

    if (!provider) {
      log.error('Error: No provider specified in profile or command line.')
      return 1
    }

    if (!modelName) {
      log.error('Error: No model specified in profile or command line.')
      return 1
    }

    // Set up the model based on provider
    switch (provider.toLowerCase()) {
      case 'knowledge-base':
        const client = new BedrockAgentRuntimeClient({
          region: cliOptions.region || process.env.AWS_REGION || 'us-east-1',
          credentials: await fromIni({ profile: cliOptions.profile })(),
        })

        // Configure knowledge base provider with options from CLI, env vars, profile, or defaults
        const kbConfig: Partial<KnowledgeBaseConfig> = {
          region: cliOptions.region || process.env.AWS_REGION,
          knowledgeBaseId: cliOptions.kbId || process.env.KB_ID,
          profile: cliOptions.profile,
        }

        // If a model is specified, convert it to a model ARN
        if (cliOptions.model) {
          kbConfig.modelArn = convertToModelArn(cliOptions.model, kbConfig.region || 'us-east-1')
        } else if (process.env.KB_MODEL_ARN) {
          // Use environment variable if available
          kbConfig.modelArn = process.env.KB_MODEL_ARN
        }

        // Check if there are knowledge base settings in the profile
        const profileConfig = await configLoader.getEffectiveConfig(cliOptions)
        if (profileConfig.profile.knowledgeBase) {
          // Use profile settings as fallbacks
          if (!kbConfig.knowledgeBaseId) {
            kbConfig.knowledgeBaseId = profileConfig.profile.knowledgeBase.knowledgeBaseId
          }
          if (!kbConfig.modelArn) {
            kbConfig.modelArn = profileConfig.profile.knowledgeBase.modelArn
          }
          if (!kbConfig.region) {
            kbConfig.region = profileConfig.profile.knowledgeBase.region
          }
        }

        // Verify that knowledge base ID is provided
        if (!kbConfig.knowledgeBaseId) {
          console.error(chalk.red('Error: Knowledge Base ID is required when using the knowledge-base provider.'))
          console.error(chalk.yellow('You can provide it using one of the following methods:'))
          console.error(chalk.yellow('  1. Command line option: --kb-id <your-kb-id>'))
          console.error(chalk.yellow('  2. Environment variable: KB_ID=<your-kb-id>'))
          console.error(chalk.yellow('  3. Profile configuration: Run "hataraku profile set-kb <profile-name>"'))
          process.exit(1)
        }

        if (shouldShowVerbose) {
          console.log('Knowledge Base Configuration:', kbConfig)
        }

        const kbProvider = await createKnowledgeBaseProvider(client, kbConfig)

        // For knowledge base provider, disable streaming
        shouldStream = false

        // Create a model wrapper that implements the LanguageModelV1 interface
        model = {
          specificationVersion: 'v1',
          provider: 'knowledge-base',
          modelId: 'knowledge-base',
          defaultObjectGenerationMode: 'json',

          async chat(messages: CreateMessage[]) {
            if (shouldShowVerbose) {
              console.log('chat called with messages:', JSON.stringify(messages, null, 2))
            }
            const lastMessage = messages[messages.length - 1]
            if (!lastMessage || lastMessage.role !== 'user') {
              if (shouldShowVerbose) {
                console.log('Message validation failed:', lastMessage)
              }
              throw new Error('Knowledge base provider only supports user messages')
            }

            // Show loading indicator
            console.log(chalk.blue('🔍 Processing knowledge base query...'))
            const startTime = Date.now()

            const response = await kbProvider(lastMessage.content)

            // Calculate processing time
            const endTime = Date.now()
            const processingTime = ((endTime - startTime) / 1000).toFixed(2)

            // Only output the clean response to the console
            if (provider.toLowerCase() === 'knowledge-base' && !shouldShowVerbose) {
              // Clear previous output
              console.clear()
              // Output only the clean response with improved formatting
              console.log(chalk.bold.cyan('📝 Response:'))
              console.log(chalk.gray('─'.repeat(50)))
              console.log(chalk.white(response.content))
              console.log(chalk.gray(`\nProcessing time: ${processingTime} seconds`))

              // Display sources if available
              if (response.sources && response.sources.length > 0) {
                console.log(chalk.bold('\n\n📚 Sources:'))
                console.log(chalk.gray('─'.repeat(50)))
                response.sources.forEach((source, index) => {
                  console.log(
                    `\n${chalk.blue(`[${index + 1}]`)} ${chalk.bold(source.title || `${source.sourceType} Document`)}`,
                  )

                  if (source.url) {
                    console.log(`    ${chalk.cyan('🔗 URL:')} ${chalk.underline(source.url)}`)
                  }

                  // Show author if available
                  if (source.metadata && source.metadata['x-amz-bedrock-kb-author']) {
                    console.log(`    ${chalk.yellow('👤 Author:')} ${source.metadata['x-amz-bedrock-kb-author']}`)
                  }

                  // Show creation date if available
                  if (source.metadata && source.metadata['x-amz-bedrock-kb-createdAt']) {
                    console.log(`    ${chalk.green('📅 Created:')} ${source.metadata['x-amz-bedrock-kb-createdAt']}`)
                  }

                  console.log(chalk.gray('─'.repeat(30)))
                })
              }
            }

            return {
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: response.content,
                  },
                },
              ],
            }
          },

          async doGenerate(messages: CreateMessage[]) {
            if (shouldShowVerbose) {
              console.log('doGenerate called with messages:', JSON.stringify(messages, null, 2))
            }

            // Extract the user's query from the complex message format
            let userQuery = ''

            // Handle different message formats
            try {
              // Check if messages is an object with a prompt property
              if (messages && typeof messages === 'object' && !Array.isArray(messages) && 'prompt' in messages) {
                const messagesObj = messages as unknown as { prompt: any[] }
                if (Array.isArray(messagesObj.prompt)) {
                  // Look for user messages in the prompt array
                  for (let i = 0; i < messagesObj.prompt.length; i++) {
                    const msg = messagesObj.prompt[i]
                    if (msg && msg.role === 'user' && msg.content) {
                      if (typeof msg.content === 'string') {
                        userQuery = msg.content
                        break
                      } else if (Array.isArray(msg.content)) {
                        // Look for text content in the content array
                        for (let j = 0; j < (msg.content as any[]).length; j++) {
                          const item = (msg.content as any[])[j] as unknown as { type: string; text: string }
                          if (item && item.type === 'text' && item.text) {
                            userQuery = item.text
                            break
                          }
                        }
                        if (userQuery) {
                          break
                        }
                      }
                    }
                  }
                }
              } else if (Array.isArray(messages)) {
                // Standard array of messages format
                // Find the last user message
                for (let i = messages.length - 1; i >= 0; i--) {
                  const msg = messages[i]
                  if (msg.role === 'user') {
                    if (typeof msg.content === 'string') {
                      userQuery = msg.content
                      break
                    } else if (Array.isArray(msg.content)) {
                      // Look for text content in the content array
                      for (let j = 0; j < (msg.content as any[]).length; j++) {
                        const item = (msg.content as any[])[j] as unknown as { type: string; text: string }
                        if (item && item.type === 'text' && item.text) {
                          userQuery = item.text
                          break
                        }
                      }
                      if (userQuery) {
                        break
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing messages:', error)
            }

            if (!userQuery) {
              console.log('Could not extract user query from messages')
              throw new Error('Could not extract user query from messages')
            }

            if (shouldShowVerbose) {
              console.log('Extracted user query:', userQuery)
            }

            try {
              console.log(chalk.blue('🔍 Processing knowledge base query...'))
              const startTime = Date.now()
              const response = await kbProvider(userQuery)
              const endTime = Date.now()
              const processingTime = ((endTime - startTime) / 1000).toFixed(2)

              // Clear previous output
              console.clear()
              // Output only the clean response with improved formatting
              console.log(chalk.bold.cyan('📝 Response:'))
              console.log(chalk.gray('─'.repeat(50)))
              console.log(chalk.white(response.content))
              console.log(chalk.gray(`\nProcessing time: ${processingTime} seconds`))

              // Display sources if available
              if (response.sources && response.sources.length > 0) {
                console.log(chalk.bold('\n\n📚 Sources:'))
                console.log(chalk.gray('─'.repeat(50)))
                response.sources.forEach((source, index) => {
                  console.log(
                    `\n${chalk.blue(`[${index + 1}]`)} ${chalk.bold(source.title || `${source.sourceType} Document`)}`,
                  )

                  if (source.url) {
                    console.log(`    ${chalk.cyan('🔗 URL:')} ${chalk.underline(source.url)}`)
                  }

                  // Show author if available
                  if (source.metadata && source.metadata['x-amz-bedrock-kb-author']) {
                    console.log(`    ${chalk.yellow('👤 Author:')} ${source.metadata['x-amz-bedrock-kb-author']}`)
                  }

                  // Show creation date if available
                  if (source.metadata && source.metadata['x-amz-bedrock-kb-createdAt']) {
                    console.log(`    ${chalk.green('📅 Created:')} ${source.metadata['x-amz-bedrock-kb-createdAt']}`)
                  }

                  console.log(chalk.gray('─'.repeat(30)))
                })
              }

              return {
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: response.content,
                    },
                  },
                ],
                usage: {
                  promptTokens: 0, // Knowledge base doesn't provide token counts
                  completionTokens: 0,
                  totalTokens: 0,
                },
              }
            } catch (error) {
              console.error('Error from knowledge base provider:', error)

              // Format a user-friendly error message
              let errorMessage = 'An error occurred while querying the knowledge base.'

              if (error.name === 'ExpiredTokenException') {
                errorMessage = 'Your AWS credentials have expired. Please refresh your AWS credentials and try again.'
              } else if (error.name === 'AccessDeniedException') {
                errorMessage = 'Access denied to the knowledge base. Please check your AWS permissions.'
              } else if (error.name === 'ResourceNotFoundException') {
                errorMessage = 'Knowledge base not found. Please check your knowledge base ID.'
              } else if (error.name === 'ValidationException') {
                errorMessage = 'Invalid request to the knowledge base. Please check your configuration.'
              } else if (error.message) {
                errorMessage = `Error: ${error.message}`
              }

              return {
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: errorMessage,
                    },
                  },
                ],
                usage: {
                  promptTokens: 0,
                  completionTokens: 0,
                  totalTokens: 0,
                },
              }
            }
          },
        } as unknown as LanguageModelV1
        break
      case 'bedrock':
        model = await createBedrockModel(cliOptions.profile, cliOptions.model)
        break
      case 'openrouter':
      default:
        if (!cliOptions.apiKey) {
          throw new Error('API key is required for OpenRouter')
        }
        const openRouter = createOpenRouter({
          apiKey: cliOptions.apiKey,
        })
        model = openRouter as unknown as LanguageModelV1
        break
    }

    // Initialize agent using our factory function and include MCP tools
    const cliAgent = await createCLIAgent(model, {
      verbose: shouldShowVerbose,
    })

    // Output verbose information if enabled
    if (shouldShowVerbose) {
      log.system('\nVerbose mode enabled. Showing intermediate task information.')
      log.system(`Using provider: ${provider}, model: ${modelName}`)
      log.system(`Stream: ${shouldStream ? 'enabled' : 'disabled'}, Sound: ${shouldPlaySound ? 'enabled' : 'disabled'}`)
    }

    log.system('\n🔍 Processing task...')

    // Options object for functions
    const options = {
      sound: shouldPlaySound,
      stream: shouldStream,
      verbose: shouldShowVerbose,
    }

    if (shouldUseInteractive) {
      // Interactive mode
      const thread = new Thread()
      async function runInteractiveTask(currentTask?: string) {
        let taskToRun = currentTask

        if (!taskToRun) {
          taskToRun = await input({
            message: 'Enter your task, or type "/exit" to exit\n\n> ',
            default: task, // Use provided task argument as default if available
          })

          if (!taskToRun || taskToRun === '/exit' || taskToRun === '/quit') {
            log.warning('Exiting interactive mode.')
            return 0
          }
        }

        // Handle slash commands
        if (taskToRun.startsWith('/')) {
          const command = taskToRun.toLowerCase()
          switch (command) {
            case '/cost':
              const messages = thread.getMessages()
              const lastMessage = messages[messages.length - 1]
              const usage = lastMessage.providerOptions
              log.system(`\nUsage stats: ${JSON.stringify(usage, null, 2)}`)
              return runInteractiveTask()
            default:
              log.warning(`Unknown command: ${command}`)
              log.system('Available commands:')
              log.system('  /cost - Show usage stats for this session')
              log.system('  /exit - Exit interactive mode (same as "/quit")')
              return runInteractiveTask()
          }
        }

        log.system(`\nExecuting task: ${taskToRun}`)

        try {
          if (shouldStream) {
            const result = await cliAgent.task(taskToRun, {
              stream: true,
              verbose: shouldShowVerbose,
              thread,
            })
            await processStreams(result, options)
          } else {
            const result = await cliAgent.task(taskToRun, {
              verbose: shouldShowVerbose,
              thread,
            })
            log.success(result)
          }

          // Add a small delay to ensure task history is saved
          await new Promise(resolve => setTimeout(resolve, 100))

          // Finally play the celebratory audio
          if (shouldPlaySound) {
            await playAudioTool.execute({ path: 'audio/celebration.wav' }, { toolCallId: 'celebration', messages: [] })
          }

          // Prompt for next task
          return runInteractiveTask()
        } catch (error) {
          log.error(`Error executing task: ${error}`)
          return runInteractiveTask()
        }
      }

      return runInteractiveTask(task)
    } else {
      // Normal mode
      if (!task) {
        log.error('Error: Please provide a task or question')
        return 1
      }

      log.system(`\nExecuting task: ${task}`)

      try {
        if (shouldStream) {
          const result = await cliAgent.task(task, {
            stream: true,
            verbose: shouldShowVerbose,
          })
          await processStreams(result, options)
        } else {
          const result = await cliAgent.task(task, {
            verbose: shouldShowVerbose,
          })
          log.success(result)
        }

        // Add a small delay to ensure task history is saved
        await new Promise(resolve => setTimeout(resolve, 100))

        if (shouldPlaySound) {
          await playAudioTool.execute({ path: 'audio/celebration.wav' }, { toolCallId: 'celebration', messages: [] })
        }
        return 0
      } catch (error) {
        log.error(`Error executing task: ${error}`)
        return 1
      }
    }
  } catch (error) {
    log.error(`Error: ${error}`)
    log.warning('\nDebug Information:')
    log.warning(`Provider: ${cliOptions.provider}`)
    log.warning(`Model: ${cliOptions.model}`)
    return 1
  }
}

/**
 * Main function to handle command line invocation
 */
export async function main(task?: string, program?: Command) {
  const options = program?.opts() || {}
  const cliOptions: CliOptions = {
    profile: options.profile,
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    stream: options.stream,
    sound: options.sound,
    verbose: options.verbose,
    agent: options.agent,
    region: options.region,
  }

  // Handle interactive mode separately
  const isInteractive = options.interactive

  return executeWithConfig(task, cliOptions, isInteractive)
}

/**
 * Function for programmatic CLI usage
 */
export async function runCLI(input: string): Promise<void> {
  try {
    const configLoader = new ConfigLoader()
    const profile = await new ProfileManager().getActiveProfile()

    const cliOptions: CliOptions = {
      provider: profile.provider,
      model: profile.model,
      stream: false,
      sound: false,
      verbose: false,
    }

    await executeWithConfig(input, cliOptions, false)
  } catch (error) {
    log.error(`Error: ${error}`)
    throw error
  }
}
