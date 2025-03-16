import { Tool, ToolExecutionOptions } from 'ai';
import { applyDiffTool } from '../apply-diff';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs and path modules
jest.mock('fs/promises');
jest.mock('path');

describe('applyDiffTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = applyDiffTool as Required<Tool>;

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`);
  });

  it('should successfully apply a diff with line numbers', async () => {
    const originalContent = 'line 1\nline 2\nline 3\nline 4\n';
    const diffContent = `<<<<<<< SEARCH
line 2
line 3
=======
new line 2
new line 3
>>>>>>> REPLACE`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(originalContent);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result = await tool.execute({
      path: 'test.txt',
      diff: diffContent,
      start_line: 2,
      end_line: 3
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('Successfully applied diff to test.txt');
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/mock/path/test.txt',
      'line 1\nnew line 2\nnew line 3\nline 4\n',
      'utf-8'
    );
  });

  it('should fail when file is not found', async () => {
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const result = await tool.execute({
      path: 'nonexistent.txt',
      diff: 'some diff content',
      start_line: 1,
      end_line: 2
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('File not found at path: nonexistent.txt');
  });

  it('should fail with invalid diff format', async () => {
    const invalidDiff = 'invalid diff content';
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('original content');

    const result = await tool.execute({
      path: 'test.txt',
      diff: invalidDiff,
      start_line: 1,
      end_line: 1
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to apply diff: Invalid diff format');
  });

  it('should fail when search content does not match', async () => {
    const originalContent = 'line 1\nline 2\nline 3\n';
    const diffContent = `<<<<<<< SEARCH
different content
=======
new content
>>>>>>> REPLACE`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(originalContent);

    const result = await tool.execute({
      path: 'test.txt',
      diff: diffContent,
      start_line: 1,
      end_line: 1
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to apply diff: Search content does not match');
  });

  it('should fail with invalid line range', async () => {
    const originalContent = 'line 1\nline 2\n';
    const diffContent = `<<<<<<< SEARCH
line 1
=======
new line 1
>>>>>>> REPLACE`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(originalContent);

    const result = await tool.execute({
      path: 'test.txt',
      diff: diffContent,
      start_line: 1,
      end_line: 5 // File only has 2 lines
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to apply diff: Invalid line range');
  });

  it('should successfully apply a diff without line numbers', async () => {
    const originalContent = 'line 1\nline 2\nline 3\n';
    const diffContent = `<<<<<<< SEARCH
line 2
=======
new line 2
>>>>>>> REPLACE`;

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(originalContent);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result = await tool.execute({
      path: 'test.txt',
      diff: diffContent
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('Successfully applied diff to test.txt');
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/mock/path/test.txt',
      'line 1\nnew line 2\nline 3\n',
      'utf-8'
    );
  });
});