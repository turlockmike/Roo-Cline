import { Tool, ToolExecutionOptions } from 'ai';
import { searchFilesTool } from '../search-files';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('fast-glob', () => jest.fn().mockImplementation(() => Promise.resolve([])));

describe('searchFilesTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = searchFilesTool as Required<Tool>;

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`);
    mockPath.join.mockImplementation((...parts) => parts.join('/'));
    // Reset fast-glob mock
    const fg = jest.requireMock('fast-glob');
    fg.mockReset();
  });

  it('should find matches with context', async () => {
    const mockFiles = ['file1.ts', 'file2.ts'];
    const mockContent = 'before line\ntarget line\nafter line';
    
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(mockFiles);
    mockFs.readFile.mockResolvedValue(mockContent);

    const result = await tool.execute({
      path: 'src',
      regex: 'target',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('File: file1.ts:2');
    expect(result.content[0].text).toContain('1  before line');
    expect(result.content[0].text).toContain('2 > target line');
    expect(result.content[0].text).toContain('3  after line');
  });

  it('should handle invalid regex patterns', async () => {
    const result = await tool.execute({
      path: 'src',
      regex: '[invalid regex',
      file_pattern: '*.ts'
    }, mockOptions);

    const fg = jest.requireMock('fast-glob');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid regular expression/);
    expect(fg).not.toHaveBeenCalled();
  });

  it('should handle no matching files', async () => {
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue([]);

    const result = await tool.execute({
      path: 'src',
      regex: 'pattern',
      file_pattern: '*.xyz'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('No files found matching pattern: *.xyz');
  });

  it('should handle no matches in files', async () => {
    const mockFiles = ['file1.ts', 'file2.ts'];
    const mockContent = 'content without matches';
    
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(mockFiles);
    mockFs.readFile.mockResolvedValue(mockContent);

    const result = await tool.execute({
      path: 'src',
      regex: 'nonexistent',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('No matches found for pattern: nonexistent');
  });

  it('should handle file read errors gracefully', async () => {
    const mockFiles = ['file1.ts', 'file2.ts'];
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(mockFiles);
    mockFs.readFile.mockRejectedValue(new Error('Read error'));

    const result = await tool.execute({
      path: 'src',
      regex: 'pattern',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('No matches found for pattern: pattern');
  });

  it('should handle multiple matches in the same file', async () => {
    const mockFiles = ['file.ts'];
    const mockContent = 'line 1\ntarget line\nother content\ntarget line again';
    
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(mockFiles);
    mockFs.readFile.mockResolvedValue(mockContent);

    const result = await tool.execute({
      path: 'src',
      regex: 'target',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    const output = result.content[0].text;
    expect(output).toContain('File: file.ts:2');
    expect(output).toContain('File: file.ts:4');
    expect(mockContent.match(/target/g)?.length).toBe(2);
  });

  it('should respect glob ignore patterns', async () => {
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(['file.ts']);

    await tool.execute({
      path: 'src',
      regex: 'pattern',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(fg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignore: expect.arrayContaining([
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**'
        ])
      })
    );
  });

  it('should handle glob errors', async () => {
    const fg = jest.requireMock('fast-glob');
    fg.mockRejectedValue(new Error('Glob error'));

    const result = await tool.execute({
      path: 'src',
      regex: 'pattern',
      file_pattern: '*.ts'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error searching files: Glob error');
  });

  it('should use default file pattern when none provided', async () => {
    const fg = jest.requireMock('fast-glob');
    fg.mockResolvedValue(['file.txt']);
    mockFs.readFile.mockResolvedValue('content');

    await tool.execute({
      path: 'src',
      regex: 'pattern'
    }, mockOptions);

    expect(fg).toHaveBeenCalledWith(
      expect.stringContaining('**/*'),
      expect.any(Object)
    );
  });
});