import { Command } from 'commander';
import chalk from 'chalk';
import { ToolManager } from '../../config/ToolManager';
import { input, select, confirm } from '@inquirer/prompts';
import { ToolsConfig } from '../../config/toolConfig';
import { McpClient } from '../../core/mcp/mcp-client';
import { getMcpTools } from '../../core/mcp/toolWrapper';

export function registerToolCommands(program: Command): Command {
  const toolCommand = program
    .command('tools')
    .description('Manage MCP tool configurations');

  toolCommand
    .command('list')
    .description('List all configured tools')
    .action(async () => {
      try {
        const toolManager = new ToolManager();
        const tools = await toolManager.listTools();
        
        console.log(chalk.bold('\nConfigured Tools:'));
        if (tools.length === 0) {
          console.log(chalk.gray('  No tools configured'));
        } else {
          for (const tool of tools) {
            console.log(`  - ${chalk.cyan(tool)}`);
          }
        }
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error listing tools:'), error);
        process.exit(1);
      }
    });

  toolCommand
    .command('show <name>')
    .description('Show tool configuration details')
    .action(async (name: string) => {
      try {
        const toolManager = new ToolManager();
        const config = await toolManager.getTool(name);
        
        console.log(chalk.bold(`\nTool Configuration: ${name}`));
        console.log(chalk.gray('─'.repeat(40)));
        
        for (const server of config.mcpServers) {
          console.log(chalk.bold(`\nServer: ${server.name}`));
          console.log(`${chalk.blue('Command:')}     ${server.command} ${server.args?.join(' ') || ''}`);
          
          if (server.env) {
            console.log(chalk.blue('Environment:'));
            for (const [key, value] of Object.entries(server.env)) {
              console.log(`  ${key} = ${value}`);
            }
          }
          
          if (server.enabledTools && server.enabledTools.length > 0) {
            console.log(chalk.blue('Enabled Tools:'));
            for (const tool of server.enabledTools) {
              console.log(`  - ${tool}`);
            }
          }
          
          if (server.disabledTools && server.disabledTools.length > 0) {
            console.log(chalk.blue('Disabled Tools:'));
            for (const tool of server.disabledTools) {
              console.log(`  - ${tool}`);
            }
          }
        }
        console.log('');
      } catch (error) {
        console.error(chalk.red(`Error showing tool configuration '${name}':`, (error as Error).message));
        process.exit(1);
      }
    });

  toolCommand
    .command('add <name>')
    .description('Add new tool configuration')
    .action(async (name: string) => {
      try {
        const toolManager = new ToolManager();
        
        // Check if tool already exists
        const tools = await toolManager.listTools();
        if (tools.includes(name)) {
          const overwrite = await confirm({
            message: `Tool configuration '${name}' already exists. Overwrite?`,
            default: false
          });
          
          if (!overwrite) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }
        }
        
        // Collect information about the tool configuration
        const serverName = await input({
          message: 'Server name:',
          default: 'default'
        });
        
        const command = await input({
          message: 'Command:',
          validate: (input) => input.trim() ? true : 'Command is required'
        });
        
        const args = await input({
          message: 'Arguments (space separated):',
        });
        
        // Parse arguments into array
        const argsArray = args.trim() ? args.split(/\s+/) : [];
        
        // Ask about environment variables
        const envVars: Record<string, string> = {};
        let addingEnvVars = true;
        
        console.log(chalk.cyan('\nEnvironment Variables (empty key to finish):'));
        while (addingEnvVars) {
          const key = await input({
            message: 'Environment variable key:',
          });
          
          if (!key.trim()) {
            addingEnvVars = false;
            continue;
          }
          
          const value = await input({
            message: `Value for ${key}:`,
          });
          
          envVars[key] = value;
        }
        
        // Create tool configuration
        const config: ToolsConfig = {
          mcpServers: [
            {
              name: serverName,
              command,
              args: argsArray.length > 0 ? argsArray : undefined,
              env: Object.keys(envVars).length > 0 ? envVars : undefined
            }
          ]
        };
        
        // Create or update tool configuration
        if (tools.includes(name)) {
          await toolManager.updateTool(name, config);
          console.log(chalk.green(`\nTool configuration '${name}' updated successfully.`));
        } else {
          await toolManager.createTool(name, config);
          console.log(chalk.green(`\nTool configuration '${name}' created successfully.`));
        }
      } catch (error) {
        console.error(chalk.red('Error adding tool configuration:'), error);
        process.exit(1);
      }
    });

  toolCommand
    .command('remove <name>')
    .description('Remove tool configuration')
    .action(async (name: string) => {
      try {
        const toolManager = new ToolManager();
        
        // Check if tool exists
        const tools = await toolManager.listTools();
        if (!tools.includes(name)) {
          console.error(chalk.red(`Tool configuration '${name}' not found.`));
          process.exit(1);
        }
        
        // Confirm deletion
        const confirmDelete = await confirm({
          message: `Are you sure you want to delete tool configuration '${name}'?`,
          default: false
        });
        
        if (!confirmDelete) {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }
        
        await toolManager.deleteTool(name);
        console.log(chalk.green(`\nTool configuration '${name}' deleted successfully.`));
      } catch (error) {
        console.error(chalk.red('Error removing tool configuration:'), error);
        process.exit(1);
      }
    });

  toolCommand
    .command('enable <name> [tool]')
    .description('Enable tool or specific capability')
    .action(async (name: string, tool?: string) => {
      try {
        const toolManager = new ToolManager();
        
        // Check if tool exists
        const tools = await toolManager.listTools();
        if (!tools.includes(name)) {
          console.error(chalk.red(`Tool configuration '${name}' not found.`));
          process.exit(1);
        }
        
        await toolManager.enableTool(name, tool);
        if (tool) {
          console.log(chalk.green(`\nTool capability '${tool}' enabled in '${name}' configuration.`));
        } else {
          console.log(chalk.green(`\nAll capabilities enabled in '${name}' configuration.`));
        }
      } catch (error) {
        console.error(chalk.red('Error enabling tool capability:'), error);
        process.exit(1);
      }
    });

  toolCommand
    .command('disable <name> [tool]')
    .description('Disable tool or specific capability')
    .action(async (name: string, tool?: string) => {
      try {
        const toolManager = new ToolManager();
        
        // Check if tool exists
        const tools = await toolManager.listTools();
        if (!tools.includes(name)) {
          console.error(chalk.red(`Tool configuration '${name}' not found.`));
          process.exit(1);
        }
        
        await toolManager.disableTool(name, tool);
        if (tool) {
          console.log(chalk.green(`\nTool capability '${tool}' disabled in '${name}' configuration.`));
        } else {
          console.log(chalk.green(`\nAll capabilities disabled in '${name}' configuration.`));
        }
      } catch (error) {
        console.error(chalk.red('Error disabling tool capability:'), error);
        process.exit(1);
      }
    });

  toolCommand
    .command('check')
    .description('Check MCP servers and list available tools')
    .action(async () => {
      try {
        const toolManager = new ToolManager();
        const toolConfigs = await toolManager.listTools();
        
        if (toolConfigs.length === 0) {
          console.log(chalk.yellow('\nNo tool configurations found.'));
          console.log(chalk.cyan('Use `tools add <name>` to add a new tool configuration.'));
          return;
        }
        
        console.log(chalk.bold('\nChecking MCP servers and available tools...\n'));
        
        // Check each tool configuration
        for (const toolConfig of toolConfigs) {
          try {
            console.log(chalk.cyan(`📋 Configuration: ${chalk.bold(toolConfig)}`));
            
            // Get and resolve the tool configuration
            const config = await toolManager.getResolvedToolConfig(toolConfig);
            
            // Convert to format expected by McpClient
            const mcpConfig = {
              mcpServers: {}
            };
            
            for (const server of config.mcpServers) {
              mcpConfig.mcpServers[server.name] = {
                command: server.command,
                args: server.args || [],
                env: server.env || {},
                disabledTools: server.disabledTools
              };
            }
            
            // Create client
            const client = new McpClient();
            
            try {
              // Load the configuration
              
              await client.loadConfig(mcpConfig);
              
              
              // Get all available servers
              const servers = client.getAvailableServers();

              
              if (servers.length === 0) {
                console.log(chalk.yellow('  No servers connected.'));
                continue;
              }
              
              // Check each server
              for (const server of servers) {
                console.log(chalk.blue(`\n  🔌 Server: ${chalk.bold(server)}`));
                
                try {
                  // Get tools for this server
                  const serverTools = await client.getServerTools(server);
                  
                  if (serverTools.tools.length === 0) {
                    console.log(chalk.yellow('    No tools available.'));
                    continue;
                  }
                  
                  // Display available tools
                  console.log(chalk.green('    Available tools:'));
                  for (const tool of serverTools.tools) {
                    console.log(`    - ${chalk.green(tool.name)}:`);
                    console.log(`      ${formatToolDescription(tool.description || 'No description')}`);
                    console.log(); // Add blank line between tools
                  }
                } catch (error) {
                  console.error(chalk.red(`    Error getting tools: ${(error as Error).message}`));
                }
              }
            } catch (error) {
              console.log('error', error);
              console.error(chalk.red(`  Error connecting to servers: ${(error as Error).message}`));
            } finally {
              // Disconnect from all servers
              for (const server of client.getAvailableServers()) {
                try {
                  await client.disconnectServer(server);
                } catch (e) {
                  // Ignore disconnect errors
                }
              }
            }
            
          } catch (error) {
            console.error(chalk.red(`Error checking tool configuration '${toolConfig}': ${(error as Error).message}`));
          }
        }
        
        console.log(''); // Empty line at the end
      } catch (error) {
        console.error(chalk.red('Error checking tools:'), error);
        process.exit(1);
      }
    });

  return program;
}

/**
 * Format tool description with proper wrapping and indentation
 */
function formatToolDescription(description: string): string {
  // Split description into lines
  const lines = description.split('\n');
  
  // Format the lines with word wrapping
  let result = lines.map(line => {
    // Simple word wrapping at ~80 chars
    const MAX_LINE_LENGTH = 80;
    if (line.length <= MAX_LINE_LENGTH) return line;
    
    // For longer lines, try to wrap at spaces
    const words = line.split(' ');
    let currentLine = '';
    let formatted = '';
    
    for (const word of words) {
      if ((currentLine + word).length > MAX_LINE_LENGTH && currentLine) {
        formatted += currentLine + '\n      ';
        currentLine = '';
      }
      currentLine += (currentLine ? ' ' : '') + word;
    }
    
    if (currentLine) {
      formatted += currentLine;
    }
    
    return formatted;
  }).join('\n      ');
  
  return result;
} 