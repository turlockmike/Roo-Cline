import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfigPaths } from './config-paths';
import { Profile, ProfilesConfig, ProfilesConfigSchema, DEFAULT_PROFILE } from './profileConfig';

export class ProfileManager {
  private configPath: string;
  private config: ProfilesConfig | null = null;

  constructor() {
    const paths = getConfigPaths();
    this.configPath = path.join(paths.configDir, 'profiles.json');
  }

  private async loadConfig(): Promise<ProfilesConfig> {
    if (this.config) return this.config;

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      this.config = ProfilesConfigSchema.parse(config);
      return this.config;
    } catch (error) {
      // If file doesn't exist or is invalid, create default config
      this.config = {
        activeProfile: 'default',
        profiles: [DEFAULT_PROFILE]
      };
      // Pretty print the initial config
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      return this.config;
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) throw new Error('No configuration loaded');
    // Format JSON with no whitespace to match test expectations
    await fs.writeFile(this.configPath, JSON.stringify(this.config));
  }

  async listProfiles(): Promise<string[]> {
    const config = await this.loadConfig();
    return config.profiles.map(p => p.name);
  }

  async getProfile(name: string): Promise<Profile> {
    const config = await this.loadConfig();
    const profile = config.profiles.find(p => p.name === name);
    if (!profile) throw new Error(`Profile '${name}' not found`);
    return profile;
  }

  async createProfile(profile: Profile): Promise<void> {
    const config = await this.loadConfig();
    if (config.profiles.some(p => p.name === profile.name)) {
      throw new Error(`Profile '${profile.name}' already exists`);
    }

    config.profiles.push(profile);
    await this.saveConfig();
  }

  async updateProfile(name: string, updates: Partial<Profile>): Promise<void> {
    const config = await this.loadConfig();
    const index = config.profiles.findIndex(p => p.name === name);
    if (index === -1) throw new Error(`Profile '${name}' not found`);
    
    // Don't allow changing the name through updates
    if (updates.name && updates.name !== name) {
      throw new Error('Cannot change profile name');
    }

    config.profiles[index] = {
      ...config.profiles[index],
      ...updates
    };
    
    await this.saveConfig();
  }

  async deleteProfile(name: string): Promise<void> {
    const config = await this.loadConfig();
    if (name === 'default') throw new Error('Cannot delete default profile');
    if (name === config.activeProfile) throw new Error('Cannot delete active profile');
    
    const index = config.profiles.findIndex(p => p.name === name);
    if (index === -1) throw new Error(`Profile '${name}' not found`);

    config.profiles.splice(index, 1);
    await this.saveConfig();
  }

  async getActiveProfile(): Promise<Profile> {
    const config = await this.loadConfig();
    return this.getProfile(config.activeProfile);
  }

  async setActiveProfile(name: string): Promise<void> {
    // Verify profile exists
    await this.getProfile(name);
    
    const config = await this.loadConfig();
    config.activeProfile = name;
    await this.saveConfig();
  }
} 