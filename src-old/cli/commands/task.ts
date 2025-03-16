import { Command } from 'commander';
import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { TaskManager } from '../../config/TaskManager';
import { ProfileManager } from '../../config/ProfileManager';
import { AgentManager } from '../../config/agent-manager';
import { ConfigLoader, CliOptions } from '../../config/config-loader';
import { executeWithConfig } from '../execution';
import { createCLIAgent } from '../../core/agents';
import { createBedrockProvider } from '../../core/providers/bedrock';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export function registerTaskCommands(program: Command): Command {
  const taskCommand = program
    .command('task')
    .description('Manage tasks');

  taskCommand
    .command('list')
    .description('List all tasks')
    .action(async () => {
      try {
        const taskManager = new TaskManager();
        const tasks = await taskManager.listTasks();
        
        console.log(chalk.bold('\nAvailable Tasks:'));
        if (tasks.length === 0) {
          console.log(chalk.gray('  No tasks found.'));
        } else {
          for (const task of tasks) {
            console.log(`  ${chalk.blue('•')} ${task}`);
          }
        }
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error listing tasks:'), error);
        process.exit(1);
      }
    });

  taskCommand
    .command('show <n>')
    .description('Show task details')
    .action(async (name: string) => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getTask(name);
        
        console.log(chalk.bold(`\nTask: ${task.name}`));
        console.log(chalk.gray('─'.repeat(30)));
        console.log(`${chalk.blue('Description:')}  ${task.description}`);
        console.log(`${chalk.blue('Agent:')}        ${task.agent}`);
        
        if (task.schema) {
          console.log(chalk.blue('\nInput Schema:'));
          console.log(`  ${JSON.stringify(task.schema, null, 2).replace(/\n/g, '\n  ')}`);
        }
        
        console.log(chalk.blue('\nTask Definition:'));
        if (typeof task.task === 'string') {
          console.log(`  ${task.task.substring(0, 100)}${task.task.length > 100 ? '...' : ''}`);
        } else {
          console.log(`  Template with parameters: ${task.task.parameters.join(', ')}`);
        }
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error showing task:'), error);
        process.exit(1);
      }
    });

  taskCommand
    .command('run <n>')
    .description('Run a task')
    .option('--agent <agent>', 'Use a specific agent for this task')
    .option('--provider <provider>', 'Use a specific provider for this task')
    .option('--model <model>', 'Use a specific model for this task')
    .option('-p, --param <params...>', 'Specify task parameters in key=value format (e.g., --param fileName=main.js language=JavaScript)')
    .option('--no-interactive', 'Skip interactive prompts for parameters')
    .action(async (name: string, options: any) => {
      try {
        const taskManager = new TaskManager();
        const task = await taskManager.getTask(name);
        
        console.log(chalk.blue(`\nPreparing to run task: ${task.name}`));
        
        // Get input for task
        const inputData: Record<string, any> = {};
        
        // First, parse any parameters passed via command line
        if (options.param && options.param.length > 0) {
          for (const paramPair of options.param) {
            const [key, ...valueParts] = paramPair.split('=');
            const value = valueParts.join('='); // Rejoin in case value contains "="
            if (key && value !== undefined) {
              // Convert value based on the schema type if available
              if (task.schema && (task.schema as any).properties && (task.schema as any).properties[key]) {
                const propType = (task.schema as any).properties[key].type;
                if (propType === 'array') {
                  inputData[key] = value.split(',').map(item => item.trim());
                } else if (propType === 'boolean') {
                  inputData[key] = value.toLowerCase() === 'true';
                } else if (propType === 'number') {
                  inputData[key] = Number(value);
                } else {
                  inputData[key] = value;
                }
              } else {
                inputData[key] = value;
              }
              console.log(chalk.green(`Parameter: ${key}=${JSON.stringify(inputData[key])}`));
            } else {
              console.error(chalk.yellow(`Warning: Skipping invalid parameter format: ${paramPair}. Use key=value format.`));
            }
          }
        }
        
        // If interactive mode is enabled and we have a schema, prompt for missing values
        if (options.interactive !== false && task.schema) {
          const schema = task.schema as any;
          if (schema.properties) {
            for (const [key, prop] of Object.entries<any>(schema.properties)) {
              // Skip if already provided via command line
              if (inputData[key] !== undefined) continue;
              
              const isRequired = schema.required && schema.required.includes(key);
              const promptMessage = `${prop.description || key}${isRequired ? ' (required)' : ''}:`;
              
              if (prop.type === 'array') {
                const items = await input({
                  message: promptMessage,
                  validate: value => {
                    if (isRequired && !value) return 'This field is required';
                    return true;
                  }
                });
                
                inputData[key] = items.split(',').map(item => item.trim());
              } else if (prop.type === 'boolean') {
                inputData[key] = await select({
                  message: promptMessage,
                  choices: [
                    { name: 'Yes', value: true },
                    { name: 'No', value: false }
                  ]
                });
              } else {
                inputData[key] = await input({
                  message: promptMessage,
                  validate: value => {
                    if (isRequired && !value) return 'This field is required';
                    return true;
                  }
                });
              }
            }
          }
        }
        
        // Validate if all required parameters are provided
        if (task.schema && (task.schema as any).required) {
          const required = (task.schema as any).required;
          const missingParams = required.filter((param: string) => inputData[param] === undefined);
          
          if (missingParams.length > 0) {
            console.error(chalk.red(`Error: Missing required parameters: ${missingParams.join(', ')}`));
            process.exit(1);
          }
        }
        
        // Process task template
        const prompt = taskManager.processTaskTemplate(task, inputData);
        
        console.log(chalk.blue('\nExecuting task...'));
        
        // Get agent (from option, task config, or default)
        const configLoader = new ConfigLoader();
        const profile = await (new ProfileManager()).getActiveProfile();
        let agent: any;
        
        if (options.agent) {
          try {
            agent = await (new AgentManager()).getAgent(options.agent);
          } catch (error) {
            console.error(chalk.yellow(`Warning: Agent '${options.agent}' not found. Using task agent.`));
          }
        }
        
        if (!agent) {
          try {
            agent = await (new AgentManager()).getAgent(task.agent);
          } catch (error) {
            console.error(chalk.yellow(`Warning: Task agent '${task.agent}' not found. Using default configuration.`));
          }
        }
        
        // Execute task with agent or directly with model
        const cliOptions: CliOptions = {
          provider: options.provider || profile.provider,
          model: options.model || profile.model,
          agent: agent?.name,
          stream: profile.options?.stream,
          sound: profile.options?.sound
        };
        
        console.log(chalk.blue('\nExecuting task with prompt:'));
        console.log(chalk.green(prompt));
        
        try {
          // Use the executeWithConfig function to actually run the task
          const code = await executeWithConfig(prompt, cliOptions, false);
          if (code !== 0) {
            console.error(chalk.red(`Task execution failed with code ${code}`));
            process.exit(code);
          }
          process.exit(0);
        } catch (execError) {
          console.error(chalk.red('Error executing task:'), execError);
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error running task:'), error);
        process.exit(1);
      }
    });

  return program;
} 