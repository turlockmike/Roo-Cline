import chalk from 'chalk';
import { createAgent } from 'hataraku';
import { createAnthropicModel } from '../src-old/core/providers';

// Initialize agent with Anthropic
async function initializeAgent() {
  console.log(chalk.yellow('🔄 Initializing Anthropic model...'));
  
  // Initialize Anthropic model
  // Note: This requires ANTHROPIC_API_KEY environment variable to be set
  const model = await createAnthropicModel('claude-3-5-sonnet-20240620');
  
  // Create an agent using our configuration
  return createAgent({
    name: 'Anthropic Agent',
    description: 'A helpful agent powered by Anthropic Claude',
    role: 'You are a helpful assistant that provides clear and concise answers.',
    model: model
  });
}

async function main() {
  console.log(chalk.cyan('\n🧠 Anthropic Direct Example\n'));

  try {
    // Initialize agent
    const agent = await initializeAgent();
    
    // Define a prompt
    const prompt = 'Explain quantum computing in simple terms.';
    
    // Display the prompt
    console.log(chalk.cyan('📥 Prompt:'));
    console.log(chalk.gray(`   ${prompt}\n`));
    
    // Start streaming
    console.log(chalk.magenta('✨ Generating response with streaming...\n'));
    
    // Track start time for performance measurement
    const startTime = Date.now();
    
    // Execute task with streaming
    const result = await agent.task(prompt, {stream: true});
    
    // Display streaming results
    for await (const chunk of result) {
      // Print chunk without newline to show streaming effect
      process.stdout.write(chunk);
    }
    
    // Calculate and display generation time
    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;
    
    console.log(chalk.cyan(`\n\n⏱️ Generation time: ${generationTime.toFixed(2)} seconds\n`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    console.error(chalk.yellow('\nNote: This example requires an Anthropic API key.'));
    console.error(chalk.yellow('Make sure you have set the ANTHROPIC_API_KEY environment variable.'));
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);