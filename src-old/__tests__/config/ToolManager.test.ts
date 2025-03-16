import * as fs from 'fs/promises';
import * as path from 'path';
import { ToolManager } from '../../config/ToolManager';
import { ToolsConfig, DEFAULT_AI_TOOLS } from '../../config/toolConfig';
import { getConfigPaths } from '../../config/config-paths';

// Mock fs and path modules
jest.mock('fs/promises');
jest.mock('path');
jest.mock('../../config/config-paths');

describe('ToolManager', () => {
  let toolManager: ToolManager;
  const mockToolsDir = '/mock/config/tools';
  const mockToolPath = '/mock/config/tools/test-tool.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getConfigPaths to return the mock directory structure
    (getConfigPaths as jest.Mock).mockReturnValue({
      configDir: '/mock/config',
      dataDir: '/mock/data',
      toolsDir: mockToolsDir,
      agentsDir: '/mock/config/agents',
      tasksDir: '/mock/config/tasks',
      logsDir: '/mock/data/logs'
    });
    
    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => {
      if (args[0] === mockToolsDir && args[1] === 'test-tool.json') {
        return mockToolPath;
      }
      return args.join('/');
    });
    
    toolManager = new ToolManager();
  });
  
  describe('listTools', () => {
    it('should return an array of tool names', async () => {
      // Mock fs.readdir
      (fs.readdir as jest.Mock).mockResolvedValue(['test-tool.json', 'another-tool.json', 'not-a-tool.txt']);
      
      // Mock path.basename to correctly handle file extensions
      (path.basename as jest.Mock).mockImplementation((file, ext) => {
        if (ext && file.endsWith(ext)) {
          return file.slice(0, -ext.length);
        }
        return file;
      });
      
      const result = await toolManager.listTools();
      
      expect(result).toEqual(['test-tool', 'another-tool']);
      expect(fs.readdir).toHaveBeenCalledWith(mockToolsDir);
    });
    
    it('should return an empty array if directory does not exist', async () => {
      // Mock fs.readdir to throw ENOENT
      (fs.readdir as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      
      const result = await toolManager.listTools();
      
      expect(result).toEqual([]);
      expect(fs.readdir).toHaveBeenCalledWith(mockToolsDir);
    });
  });
  
  describe('getTool', () => {
    it('should return a tool configuration', async () => {
      const mockConfig: ToolsConfig = {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js']
          }
        ]
      };
      
      // Mock fs.readFile
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));
      
      const result = await toolManager.getTool('test-tool');
      
      expect(result).toEqual(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith(mockToolPath, 'utf-8');
    });
    
    it('should throw an error if tool configuration is not found', async () => {
      // Mock fs.readFile to throw ENOENT
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT', message: 'File not found' });
      
      await expect(toolManager.getTool('test-tool')).rejects.toThrow(/not found or invalid/);
      expect(fs.readFile).toHaveBeenCalledWith(mockToolPath, 'utf-8');
    });
    
    it('should throw an error if tool configuration is invalid', async () => {
      // Mock fs.readFile to return invalid JSON
      (fs.readFile as jest.Mock).mockResolvedValue('{ "invalid": "json" }');
      
      await expect(toolManager.getTool('test-tool')).rejects.toThrow(/not found or invalid/);
      expect(fs.readFile).toHaveBeenCalledWith(mockToolPath, 'utf-8');
    });
  });
  
  describe('createTool', () => {
    it('should create a new tool configuration', async () => {
      // Mock fs.access to throw ENOENT
      (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      
      // Mock fs.writeFile
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await toolManager.createTool('test-tool', DEFAULT_AI_TOOLS);
      
      expect(fs.access).toHaveBeenCalledWith(mockToolPath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockToolPath,
        JSON.stringify(DEFAULT_AI_TOOLS, null, 2)
      );
    });
    
    it('should throw an error if tool configuration already exists', async () => {
      // Mock fs.access to not throw (file exists)
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      
      // The error thrown will be a regular Error, not an error with a 'code' property
      // This matches the implementation in ToolManager.createTool
      await expect(toolManager.createTool('test-tool', DEFAULT_AI_TOOLS)).rejects.toThrow(/already exists/);
      expect(fs.access).toHaveBeenCalledWith(mockToolPath);
      // No writeFile should be called if the file exists
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
  
  describe('updateTool', () => {
    it('should update an existing tool configuration', async () => {
      // Mock fs.access to not throw
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      
      // Mock fs.writeFile
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await toolManager.updateTool('test-tool', DEFAULT_AI_TOOLS);
      
      expect(fs.access).toHaveBeenCalledWith(mockToolPath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockToolPath,
        JSON.stringify(DEFAULT_AI_TOOLS, null, 2)
      );
    });
    
    it('should throw an error if tool configuration does not exist', async () => {
      // Mock fs.access to throw ENOENT
      (fs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      
      await expect(toolManager.updateTool('test-tool', DEFAULT_AI_TOOLS)).rejects.toThrow(/not found/);
      expect(fs.access).toHaveBeenCalledWith(mockToolPath);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
  
  describe('deleteTool', () => {
    it('should delete a tool configuration', async () => {
      // Mock fs.unlink
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
      
      await toolManager.deleteTool('test-tool');
      
      expect(fs.unlink).toHaveBeenCalledWith(mockToolPath);
    });
    
    it('should throw an error if tool configuration does not exist', async () => {
      // Mock fs.unlink to throw ENOENT
      (fs.unlink as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
      
      await expect(toolManager.deleteTool('test-tool')).rejects.toThrow(/not found/);
      expect(fs.unlink).toHaveBeenCalledWith(mockToolPath);
    });
  });
  
  describe('enableTool and disableTool', () => {
    const mockConfig: ToolsConfig = {
      mcpServers: [
        {
          name: 'test',
          command: 'node',
          args: ['test.js'],
          disabledTools: ['tool1', 'tool2']
        }
      ]
    };
    
    beforeEach(() => {
      // Mock getTool
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(JSON.parse(JSON.stringify(mockConfig)));
      
      // Mock updateTool
      jest.spyOn(toolManager, 'updateTool').mockResolvedValue(undefined);
    });
    
    it('should enable a specific tool', async () => {
      await toolManager.enableTool('test-tool', 'tool1');
      
      expect(toolManager.getTool).toHaveBeenCalledWith('test-tool');
      expect(toolManager.updateTool).toHaveBeenCalledWith('test-tool', {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            disabledTools: ['tool2'],
            enabledTools: ['tool1']
          }
        ]
      });
    });
    
    it('should enable all tools', async () => {
      await toolManager.enableTool('test-tool');
      
      expect(toolManager.getTool).toHaveBeenCalledWith('test-tool');
      expect(toolManager.updateTool).toHaveBeenCalledWith('test-tool', {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            disabledTools: []
          }
        ]
      });
    });
    
    it('should disable a specific tool', async () => {
      // Update mock config to have enabledTools
      const configWithEnabled: ToolsConfig = {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            enabledTools: ['tool1', 'tool2'],
            disabledTools: []
          }
        ]
      };
      
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(JSON.parse(JSON.stringify(configWithEnabled)));
      
      await toolManager.disableTool('test-tool', 'tool1');
      
      expect(toolManager.getTool).toHaveBeenCalledWith('test-tool');
      expect(toolManager.updateTool).toHaveBeenCalledWith('test-tool', {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            enabledTools: ['tool2'],
            disabledTools: ['tool1']
          }
        ]
      });
    });
    
    it('should disable all tools', async () => {
      // Update mock config to have enabledTools
      const configWithEnabled: ToolsConfig = {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            enabledTools: ['tool1', 'tool2']
          }
        ]
      };
      
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(JSON.parse(JSON.stringify(configWithEnabled)));
      
      await toolManager.disableTool('test-tool');
      
      expect(toolManager.getTool).toHaveBeenCalledWith('test-tool');
      expect(toolManager.updateTool).toHaveBeenCalledWith('test-tool', {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            enabledTools: []
          }
        ]
      });
    });
  });
  
  describe('initializeDefaults', () => {
    it('should create default tool configurations if they do not exist', async () => {
      // Mock listTools
      jest.spyOn(toolManager, 'listTools').mockResolvedValue([]);
      
      // Mock createTool
      jest.spyOn(toolManager, 'createTool').mockResolvedValue(undefined);
      
      await toolManager.initializeDefaults();
      
      expect(toolManager.listTools).toHaveBeenCalled();
      expect(toolManager.createTool).toHaveBeenCalledWith('ai-tools', DEFAULT_AI_TOOLS);
      expect(toolManager.createTool).toHaveBeenCalledWith('dev-tools', expect.any(Object));
    });
    
    it('should not create default tool configurations if they already exist', async () => {
      // Mock listTools
      jest.spyOn(toolManager, 'listTools').mockResolvedValue(['ai-tools', 'dev-tools']);
      
      // Mock createTool
      jest.spyOn(toolManager, 'createTool').mockResolvedValue(undefined);
      
      await toolManager.initializeDefaults();
      
      expect(toolManager.listTools).toHaveBeenCalled();
      expect(toolManager.createTool).not.toHaveBeenCalled();
    });
  });

  describe('getResolvedToolConfig', () => {
    it('should resolve environment variables in tool configuration', async () => {
      // Set up mock environment variables
      const originalEnv = process.env;
      process.env = { ...originalEnv, TEST_API_KEY: 'test-key-value' };

      const mockConfig: ToolsConfig = {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            env: {
              'API_KEY': '${TEST_API_KEY}',
              'DEFAULT_KEY': '${MISSING_KEY:-default-value}'
            }
          }
        ]
      };

      // Mock getTool to return config with environment variables
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(mockConfig);
      
      const result = await toolManager.getResolvedToolConfig('test-tool');
      
      // Check that environment variables are resolved
      expect(result.mcpServers[0].env?.API_KEY).toBe('test-key-value');
      expect(result.mcpServers[0].env?.DEFAULT_KEY).toBe('default-value');
      
      // Restore environment
      process.env = originalEnv;
    });

    it('should handle missing environment variables with no defaults', async () => {
      const mockConfig: ToolsConfig = {
        mcpServers: [
          {
            name: 'test',
            command: 'node',
            args: ['test.js'],
            env: {
              'API_KEY': '${MISSING_KEY}'
            }
          }
        ]
      };

      // Mock getTool
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(mockConfig);
      
      const result = await toolManager.getResolvedToolConfig('test-tool');
      
      // Check that missing environment variables become empty strings
      expect(result.mcpServers[0].env?.API_KEY).toBe('');
    });

    it('should deeply resolve variables in nested objects', async () => {
      // Set up mock environment variable
      const originalEnv = process.env;
      process.env = { ...originalEnv, TEST_VALUE: 'test-value' };

      // Create a configuration with nested objects in env
      const mockConfig: ToolsConfig = {
        mcpServers: [
          {
            name: 'test-server',
            command: 'node',
            args: ['script.js'],
            env: {
              'API_KEY': '${TEST_VALUE}',
              'CONFIG': JSON.stringify({
                'nested': '${TEST_VALUE}' // Will be stringified, so interpolation happens on the string
              })
            }
          }
        ]
      };

      // Mock getTool
      jest.spyOn(toolManager, 'getTool').mockResolvedValue(mockConfig);
      
      const result = await toolManager.getResolvedToolConfig('test-tool');
      
      // Check that environment variables are resolved
      expect(result.mcpServers[0].env?.API_KEY).toBe('test-value');
      expect(result.mcpServers[0].env?.CONFIG).toContain('test-value');
      
      // Restore environment
      process.env = originalEnv;
    });
  });
}); 