import { Command } from 'commander'
import chalk from 'chalk'
import { version } from '../../package.json'
import { FirstRunManager } from '../config/first-run-manager'

// Import command registration
import { registerAllCommands } from './commands'

// Import execution functions
import { main, runCLI } from './execution'

// Create the main program and register all commands
const program = new Command()
registerAllCommands(program)

// Configure the main program
program
  .name('hataraku')
  .description('Hataraku is a CLI tool for creating and managing tasks')
  .option('--update', 'Update Hataraku to the latest version')
  .option('-p, --provider <provider>', 'API provider to use (openrouter, bedrock, knowledge-base)')
  .option('-m, --model <model>', 'Model ID for the provider (e.g., anthropic/claude-3.5-sonnet)')
  .option('-k, --api-key <key>', 'API key for the provider (can also use PROVIDER_API_KEY env var)')
  .option('-i, --interactive', 'Run in interactive mode, prompting for tasks')
  .option('--no-sound', 'Disable sound effects')
  .option('--no-stream', 'Disable streaming responses')
  .option('-v, --verbose', 'Enable verbose output with intermediate task information')
  .option('--region <region>', 'AWS region for Bedrock/Knowledge Base (defaults to AWS_REGION env var)')
  .option('--profile <profile>', 'Use specific AWS profile')
  .option('--agent <agent>', 'Use specific agent')
  .option('--kb-id <id>', 'Knowledge Base ID when using knowledge-base provider (REQUIRED, can also use KB_ID env var)')
  .arguments('[task...]')
  .version(version)
  .addHelpText(
    'after',
    `
Examples:
  $ hataraku "create a hello world html file"                                # Uses default model (claude-3.5-sonnet)
  $ hataraku --model deepseek/deepseek-chat "explain this code"             # Uses different model
  $ hataraku --provider anthropic --model claude-3 "write a test"           # Uses different provider
  $ hataraku --provider bedrock --model us.anthropic.claude-3-7-sonnet-20250219-v1:0 "analyze this code"  # Uses AWS Bedrock
  $ hataraku --provider knowledge-base --kb-id my-kb-id "what is x?"        # Uses AWS Knowledge Base with specific ID
  $ hataraku --provider knowledge-base --model anthropic/claude-3-5-sonnet "what is x?"  # Uses Knowledge Base with specific model
  $ KB_ID=my-kb-id KB_MODEL_ARN=arn:aws:... hataraku --provider knowledge-base "what is x?"  # Uses env vars
  $ OPENROUTER_API_KEY=<key> hataraku "write a test file"                  # Provides API key via env var
  $ hataraku -i                                                             # Run in interactive mode
  $ hataraku -i "initial task"                                             # Interactive mode with initial task
  $ hataraku --no-sound "create a test file"                               # Run without sound effects
  $ hataraku --no-stream "explain this code"                               # Run without streaming responses
  $ hataraku --verbose "debug this issue"                                  # Run with verbose output
  $ hataraku --profile coding "refactor this code"                         # Use a specific AWS profile
  $ hataraku --agent code-reviewer "review my code"                        # Use a specific agent
  $ hataraku profile list                                                  # List all profiles
  $ hataraku task run code-review                                          # Run a saved task
  $ hataraku init                                                          # Initialize configuration

Environment Variables:
  OPENROUTER_API_KEY    - API key for OpenRouter
  ANTHROPIC_API_KEY     - API key for Anthropic
  OPENAI_API_KEY        - API key for OpenAI
  AWS_ACCESS_KEY_ID     - AWS access key ID for Bedrock
  AWS_SECRET_ACCESS_KEY - AWS secret access key for Bedrock
  AWS_REGION           - AWS region for Bedrock (defaults to us-east-1)`,
  )
  .action(async task => {
    // Check if this is the first run
    const firstRunManager = new FirstRunManager()
    const isFirstRun = await firstRunManager.isFirstRun()

    if (isFirstRun) {
      console.log(chalk.yellow('\nFirst run detected. Initializing default configuration...'))
      await firstRunManager.initializeDefaults()
    }

    // The task will be handled by main() after parsing
  })

// Export program and functions
export { program, main, runCLI }
