import chalk from 'chalk'
import { createAgent } from 'hataraku'
import { createVertexModel } from '../src-old/core/providers'

// Initialize agent with Google Vertex AI
async function initializeAgent() {
  console.log(chalk.yellow('🔄 Initializing Google Vertex AI model...'))

  // Initialize Google Vertex AI model
  // Note: This requires GOOGLE_APPLICATION_CREDENTIALS environment variable
  // or other Google Cloud authentication method to be set up
  const model = await createVertexModel('gemini-2.0-flash-lite-001')

  // Create an agent using our configuration
  return createAgent({
    name: 'Vertex AI Agent',
    description: 'A helpful agent powered by Google Vertex AI',
    role: 'You are a helpful assistant that provides clear and concise answers.',
    model: model,
  })
}

async function main() {
  console.log(chalk.cyan('\n🧠 Google Vertex AI Example\n'))

  try {
    // Initialize agent
    const agent = await initializeAgent()

    // Define a prompt
    const prompt = 'Explain the concept of machine learning in 3 paragraphs.'

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
    console.error(chalk.yellow('\nNote: This example requires Google Cloud authentication.'))
    console.error(chalk.yellow('Make sure you have set up the GOOGLE_APPLICATION_CREDENTIALS environment variable'))
    console.error(chalk.yellow('or other Google Cloud authentication method.'))
    process.exit(1)
  }
}

// Run the example
main().catch(console.error)
