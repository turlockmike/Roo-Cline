import chalk from 'chalk'
import { createAgent } from 'hataraku'
import { createOpenAIModel } from '../src-old/core/providers'

// Initialize agent with OpenAI
async function initializeAgent() {
  console.log(chalk.yellow('🔄 Initializing OpenAI model...'))

  // Initialize OpenAI model
  // Note: This requires OPENAI_API_KEY environment variable to be set
  const model = await createOpenAIModel('gpt-4o')

  // Create an agent using our configuration
  return createAgent({
    name: 'OpenAI Agent',
    description: 'A helpful agent powered by OpenAI',
    role: 'You are a helpful assistant that provides clear and concise answers.',
    model: model,
  })
}

async function main() {
  console.log(chalk.cyan('\n🧠 OpenAI Direct Example\n'))

  try {
    // Initialize agent
    const agent = await initializeAgent()

    // Define a prompt
    const prompt = 'Write a short poem about artificial intelligence.'

    // Display the prompt
    console.log(chalk.cyan('📥 Prompt:'))
    console.log(chalk.gray(`   ${prompt}\n`))

    // Start streaming
    console.log(chalk.magenta('✨ Generating response with streaming...\n'))

    // Track start time for performance measurement
    const startTime = Date.now()

    // Execute task with streaming
    const result = await agent.task(prompt, { stream: true })

    // Display streaming results
    for await (const chunk of result) {
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk)
    }

    // Calculate and display generation time
    const endTime = Date.now()
    const generationTime = (endTime - startTime) / 1000

    console.log(chalk.cyan(`\n\n⏱️ Generation time: ${generationTime.toFixed(2)} seconds\n`))
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error)
    console.error(chalk.yellow('\nNote: This example requires an OpenAI API key.'))
    console.error(chalk.yellow('Make sure you have set the OPENAI_API_KEY environment variable.'))
    process.exit(1)
  }
}

// Run the example
main().catch(console.error)
