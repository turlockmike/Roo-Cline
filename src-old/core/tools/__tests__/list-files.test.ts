import { Tool, ToolExecutionOptions } from 'ai';
import { listFilesTool } from '../list-files';
import * as path from 'path';
import { listFiles } from '../../../services/glob/list-files';

// Mock dependencies
jest.mock('path');
jest.mock('../../../services/glob/list-files');

describe('listFilesTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = listFilesTool as Required<Tool>;

  // Mock implementations
  const mockPath = path as jest.Mocked<typeof path>;
  const mockListFiles = listFiles as jest.MockedFunction<typeof listFiles>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`);
    mockPath.relative.mockImplementation((from, to) => to.replace(`${from}/`, '').replace(/\\/g, '/'));
  });

  it('should list files in a directory non-recursively', async () => {
    mockListFiles.mockResolvedValue([[
      '/mock/path/test-dir/file1.txt',
      '/mock/path/test-dir/file2.js',
      '/mock/path/test-dir/subdir/'
    ], false]);

    const result = await tool.execute({
      path: 'test-dir',
      recursive: false
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('file1.txt\nfile2.js\nsubdir');
    expect(mockListFiles).toHaveBeenCalledWith('/mock/path/test-dir', false, 1000);
  });

  it('should list files recursively', async () => {
    mockListFiles.mockResolvedValue([[
      '/mock/path/test-dir/file1.txt',
      '/mock/path/test-dir/subdir/subfile1.js',
      '/mock/path/test-dir/subdir/subfile2.css'
    ], false]);

    const result = await tool.execute({
      path: 'test-dir',
      recursive: true
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe(
      'file1.txt\n' +
      'subdir/subfile1.js\n' +
      'subdir/subfile2.css'
    );
  });

  it('should handle empty directories', async () => {
    mockListFiles.mockResolvedValue([[], false]);

    const result = await tool.execute({
      path: 'empty-dir'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('(empty directory)');
  });

  it('should handle directory not found', async () => {
    mockListFiles.mockRejectedValue(new Error('Directory not found'));

    const result = await tool.execute({
      path: 'non-existent-dir'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error listing files: Directory not found');
  });

  it('should handle path that is not a directory', async () => {
    mockListFiles.mockRejectedValue(new Error('Path is not a directory'));

    const result = await tool.execute({
      path: 'file.txt'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error listing files: Path is not a directory');
  });

  it('should handle read directory errors', async () => {
    mockListFiles.mockRejectedValue(new Error('Permission denied'));

    const result = await tool.execute({
      path: 'protected-dir'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error listing files: Permission denied');
  });

  it('should handle deep recursive structures', async () => {
    mockListFiles.mockResolvedValue([[
      '/mock/path/dir1/file1.txt',
      '/mock/path/dir1/subdir1/file2.js',
      '/mock/path/dir1/subdir1/subdir2/file3.css'
    ], false]);

    const result = await tool.execute({
      path: 'dir1',
      recursive: true
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe(
      'file1.txt\n' +
      'subdir1/file2.js\n' +
      'subdir1/subdir2/file3.css'
    );
  });
});