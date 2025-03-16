import { jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProfileManager } from '../../config/ProfileManager';
import { Profile, DEFAULT_PROFILE } from '../../config/profileConfig';
import { getConfigPaths } from '../../config/config-paths';

jest.mock('fs/promises');
jest.mock('../../config/config-paths');

describe('ProfileManager', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockGetConfigPaths = getConfigPaths as jest.MockedFunction<typeof getConfigPaths>;
  let profileManager: ProfileManager;
  const configPath = '/mock/config/hataraku/profiles.json';

  beforeEach(() => {
    mockGetConfigPaths.mockReturnValue({
      configDir: '/mock/config/hataraku',
      dataDir: '/mock/data/hataraku',
      toolsDir: '/mock/config/hataraku/tools',
      agentsDir: '/mock/config/hataraku/agents',
      tasksDir: '/mock/config/hataraku/tasks',
      logsDir: '/mock/data/hataraku/logs'
    });
    profileManager = new ProfileManager();
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      activeProfile: 'default',
      profiles: [DEFAULT_PROFILE]
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list profiles', async () => {
    const profiles = await profileManager.listProfiles();
    expect(profiles).toEqual(['default']);
  });

  it('should get a profile', async () => {
    const profile = await profileManager.getProfile('default');
    expect(profile).toEqual(DEFAULT_PROFILE);
  });

  describe('initialization', () => {
    it('should create default config if file does not exist', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      
      const profiles = await profileManager.listProfiles();
      
      expect(profiles).toEqual(['default']);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify({ activeProfile: 'default', profiles: [DEFAULT_PROFILE] }, null, 2)
      );
    });
  });

  describe('CRUD operations', () => {
    const mockConfig = {
      activeProfile: 'default',
      profiles: [DEFAULT_PROFILE]
    };

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
    });

    it('should get a profile', async () => {
      const profile = await profileManager.getProfile('default');
      expect(profile).toEqual(DEFAULT_PROFILE);
    });

    it('should throw when getting non-existent profile', async () => {
      await expect(profileManager.getProfile('nonexistent'))
        .rejects.toThrow("Profile 'nonexistent' not found");
    });

    it('should create a new profile', async () => {
      const newProfile: Profile = {
        name: 'test',
        description: 'Test Profile',
        provider: 'openai',
        model: 'gpt-4'
      };

      await profileManager.createProfile(newProfile);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"name":"test"')
      );
    });

    it('should not create duplicate profiles', async () => {
      await expect(profileManager.createProfile(DEFAULT_PROFILE))
        .rejects.toThrow("Profile 'default' already exists");
    });

    it('should update a profile', async () => {
      const updates = {
        description: 'Updated description',
        model: 'gpt-4'
      };

      await profileManager.updateProfile('default', updates);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"description":"Updated description"')
      );
    });

    it('should not update profile name', async () => {
      await expect(profileManager.updateProfile('default', { name: 'new-name' }))
        .rejects.toThrow('Cannot change profile name');
    });

    it('should delete a profile', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProfile: 'default',
        profiles: [DEFAULT_PROFILE, { name: 'test', description: 'Test Profile' }]
      }));

      await profileManager.deleteProfile('test');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.not.stringContaining('"name":"test"')
      );
    });

    it('should not delete default profile', async () => {
      await expect(profileManager.deleteProfile('default'))
        .rejects.toThrow('Cannot delete default profile');
    });

    it('should not delete active profile', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProfile: 'test',
        profiles: [DEFAULT_PROFILE, { name: 'test', description: 'Test Profile' }]
      }));

      await expect(profileManager.deleteProfile('test'))
        .rejects.toThrow('Cannot delete active profile');
    });
  });

  describe('active profile management', () => {
    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProfile: 'default',
        profiles: [DEFAULT_PROFILE, { name: 'test', description: 'Test Profile' }]
      }));
    });

    it('should get active profile', async () => {
      const profile = await profileManager.getActiveProfile();
      expect(profile).toEqual(DEFAULT_PROFILE);
    });

    it('should set active profile', async () => {
      await profileManager.setActiveProfile('test');
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"activeProfile":"test"')
      );
    });

    it('should not set nonexistent profile as active', async () => {
      await expect(profileManager.setActiveProfile('nonexistent'))
        .rejects.toThrow("Profile 'nonexistent' not found");
    });
  });
}); 