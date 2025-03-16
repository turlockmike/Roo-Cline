import * as fs from 'fs/promises';
import * as path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getConfigPaths, createConfigDirectories } from './config-paths';
import { ConfigLoader } from './config-loader';
import { ProfileManager } from './ProfileManager';
import { Profile, DEFAULT_PROFILE } from './profileConfig';

/**
 * First Run Manager
 * Handles first-run experience and setup wizard
 */
export class FirstRunManager {
  private configDir: string;
  private configLoader: ConfigLoader;
  private profileManager: ProfileManager;

  constructor() {
    const paths = getConfigPaths();
    this.configDir = paths.configDir;
    this.configLoader = new ConfigLoader();
    this.profileManager = new ProfileManager();
  }

  /**
   * Check if this is a first run
   * @returns True if this is a first run (config directory doesn't exist)
   */
  async isFirstRun(): Promise<boolean> {
    try {
      await fs.access(this.configDir);
      // Check if profiles.json exists
      const profilesPath = path.join(this.configDir, 'profiles.json');
      await fs.access(profilesPath);
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Initialize default configurations
   * Creates default directory structure and configurations
   */
  async initializeDefaults(): Promise<void> {
    // Create configuration directories
    createConfigDirectories();
    
    // Initialize configuration with defaults
    await this.configLoader.initializeDefaults();
    
    console.log(chalk.green('Default configuration initialized successfully.'));
  }

  /**
   * Run interactive setup wizard
   * Guides user through initial setup
   */
  async runSetupWizard(): Promise<void> {
    console.log(chalk.bold('\nWelcome to Hataraku Setup Wizard!'));
    console.log('This wizard will help you set up your initial configuration.\n');
    
    // Create configuration directories
    createConfigDirectories();
    
    // Create default profile
    const defaultProfile = await this.createDefaultProfileWithWizard();
    
    // Create default configurations
    await this.configLoader.initializeDefaults();
    
    console.log(chalk.green('\nSetup complete!'));
    console.log(chalk.blue(`Default profile '${defaultProfile.name}' created.`));
    console.log('Run `hataraku --help` to see available commands.\n');
  }

  /**
   * Create default profile with wizard
   * @returns Created default profile
   */
  async createDefaultProfileWithWizard(): Promise<Profile> {
    // Ask for profile name
    const profileName = await input({
      message: 'Profile name:',
      default: 'default'
    });
    
    // Ask for description
    const description = await input({
      message: 'Profile description:',
      default: 'Default Hataraku profile'
    });
    
    // Choose provider
    const provider = await select({
      message: 'Select default provider:',
      choices: [
        { name: 'OpenRouter (Anthropic, OpenAI, etc.)', value: 'openrouter' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'AWS Bedrock', value: 'bedrock' }
      ]
    });
    
    // Choose model based on provider
    let modelChoices;
    switch (provider) {
      case 'openrouter':
        modelChoices = [
          { name: 'Claude 3.7 Sonnet (thinking)', value: 'anthropic/claude-3.7-sonnet:thinking'},
          { name: 'Claude 3.7 Sonnet', value: 'anthropic/claude-3.7-sonnet' },
          { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
          { name: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
          { name: 'Gemini Flash 1.5', value: 'google/gemini-flash-1.5' },
          { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
          { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' }
        ];
        break;
      case 'anthropic':
        modelChoices = [
          { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
          { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' }
        ];
        break;
      case 'bedrock':
        modelChoices = [
          { name: 'Claude 3.7 Sonnet', value: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' },
          { name: 'Claude 3.5 Sonnet', value: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0' }
        ];
        break;
      default:
        modelChoices = [
          { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' }
        ];
    }
    
    const model = await select({
      message: 'Select default model:',
      choices: modelChoices
    });
    
    // Configure options
    const stream = await confirm({
      message: 'Enable streaming responses by default?',
      default: true
    });
    
    const sound = await confirm({
      message: 'Enable sound effects by default?',
      default: true
    });
    
    // Create profile
    const profile: Profile = {
      name: profileName,
      description,
      provider: provider as string,
      model: model as string,
      options: {
        stream,
        sound
      }
    };
    
    // Save profile
    try {
      await this.profileManager.createProfile(profile);
      return profile;
    } catch (error) {
      // If profile already exists (file exists), update it
      await this.profileManager.updateProfile(profileName, profile);
      return profile;
    }
  }
}