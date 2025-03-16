import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfigPaths, createConfigDirectories } from './config-paths';
import { TaskConfig, TaskConfigSchema, DEFAULT_CODE_REVIEW_TASK, DEFAULT_CODE_EXPLANATION_TASK } from './taskConfig';
import { AgentManager } from './agent-manager';

/**
 * Manager for task configurations
 * Handles CRUD operations for task configurations stored in the tasks directory
 */
export class TaskManager {
  private tasksDir: string;
  private agentManager: AgentManager;

  constructor() {
    // Ensure config directories exist
    createConfigDirectories();
    const paths = getConfigPaths();
    this.tasksDir = paths.tasksDir;
    this.agentManager = new AgentManager();
  }

  /**
   * List all available task configurations
   * @returns Array of task configuration names
   */
  async listTasks(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.tasksDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      return [];
    }
  }

  /**
   * Get a specific task configuration
   * @param name Task configuration name
   * @returns Task configuration object
   * @throws Error if task configuration not found or invalid
   */
  async getTask(name: string): Promise<TaskConfig> {
    const filePath = path.join(this.tasksDir, `${name}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(data);
      return TaskConfigSchema.parse(config);
    } catch (error) {
      throw new Error(`Task configuration '${name}' not found or invalid: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new task configuration
   * @param name Task configuration name
   * @param config Task configuration object
   * @throws Error if task configuration already exists or is invalid
   */
  async createTask(name: string, config: TaskConfig): Promise<void> {
    const filePath = path.join(this.tasksDir, `${name}.json`);
    
    try {
      // Check if file already exists
      await fs.access(filePath);
      // If we get here, the file exists, so throw an error
      throw new Error(`Task configuration '${name}' already exists`);
    } catch (error: any) {
      // Only proceed if error is that file doesn't exist (ENOENT)
      if (error.code !== 'ENOENT') {
        // If this is our own error about the file already existing, rethrow it
        if (error instanceof Error && error.message.includes('already exists')) {
          throw error;
        }
        // Otherwise throw an unexpected error
        throw error;
      }
      
      // Validate configuration
      TaskConfigSchema.parse(config);
      
      // Validate agent reference
      await this.validateAgentReference(config.agent);
      
      // Write configuration to file
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    }
  }

  /**
   * Update an existing task configuration
   * @param name Task configuration name
   * @param updates Task configuration updates
   * @throws Error if task configuration not found or is invalid
   */
  async updateTask(name: string, updates: Partial<TaskConfig>): Promise<void> {
    const filePath = path.join(this.tasksDir, `${name}.json`);
    
    try {
      // Check if file exists and get current config
      const currentConfig = await this.getTask(name);
      
      // Update config with new values
      const updatedConfig = {
        ...currentConfig,
        ...updates
      };
      
      // Validate the updated configuration
      TaskConfigSchema.parse(updatedConfig);
      
      // Validate agent reference if it was updated
      if (updates.agent) {
        await this.validateAgentReference(updatedConfig.agent);
      }
      
      // Write updated configuration to file
      await fs.writeFile(filePath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to update task '${name}': ${(error as Error).message}`);
    }
  }

  /**
   * Delete a task configuration
   * @param name Task configuration name
   * @throws Error if task configuration not found
   */
  async deleteTask(name: string): Promise<void> {
    const filePath = path.join(this.tasksDir, `${name}.json`);
    
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Task configuration '${name}' not found`);
      }
      // Only re-throw known errors, convert unknown errors to a standard message
      throw error instanceof Error ? error : new Error(`Unknown error occurred: ${error}`);
    }
  }

  /**
   * Validate agent reference in a task configuration
   * @param agentName Agent name reference
   * @throws Error if the referenced agent doesn't exist
   */
  private async validateAgentReference(agentName: string): Promise<void> {
    try {
      await this.agentManager.getAgent(agentName);
    } catch (error) {
      throw new Error(`Referenced agent '${agentName}' not found`);
    }
  }

  /**
   * Process a task template with given input
   * @param task Task configuration
   * @param input Task input
   * @returns Processed task prompt
   */
  processTaskTemplate(task: TaskConfig, input: Record<string, any>): string {
    // Handle both old and new format
    let template: string;
    let parameters: string[] = [];
    
    // Check if task.task is an object (old format) or string (new format)
    if (typeof task.task === 'object' && task.task.template) {
      // Old format: task.task is an object with template and parameters
      template = task.task.template;
      parameters = task.task.parameters || [];
    } else {
      // New format: task.task is a string and parameters is a comma-separated string
      template = task.task as string;
      parameters = task.parameters ? task.parameters.split(',').map(p => p.trim()) : [];
    }
    
    // Simple template substitution using a function that evaluates expressions in template string
    return template.replace(/\${([^}]*)}/g, (_, expr) => {
      try {
        // Use Function constructor to safely evaluate the expression with input parameters
        const evalFn = new Function(...parameters, `return ${expr}`);
        return String(evalFn(...parameters.map(param => input[param])));
      } catch (error) {
        return `[Error: ${error instanceof Error ? error.message : 'Invalid expression'}]`;
      }
    });
  }

  /**
   * Initialize default task configurations
   * Creates default task configurations if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    const tasks = await this.listTasks();
    
    // Create default code review task if not exists
    if (!tasks.includes('code-review')) {
      try {
        await this.createTask('code-review', DEFAULT_CODE_REVIEW_TASK);
      } catch (error) {
        // Ignore error if agent doesn't exist yet, will be created later
        if (!(error instanceof Error && error.message.includes('agent') && error.message.includes('not found'))) {
          throw error;
        }
      }
    }
    
    // Create default code explanation task if not exists
    if (!tasks.includes('explain-code')) {
      try {
        await this.createTask('explain-code', DEFAULT_CODE_EXPLANATION_TASK);
      } catch (error) {
        // Ignore error if agent doesn't exist yet, will be created later
        if (!(error instanceof Error && error.message.includes('agent') && error.message.includes('not found'))) {
          throw error;
        }
      }
    }
  }
}