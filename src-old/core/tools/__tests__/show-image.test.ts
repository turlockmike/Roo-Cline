import { Tool, ToolExecutionOptions } from 'ai';
import { showImageTool } from '../show-image';
import * as fs from 'fs/promises';
import * as path from 'path';
import { platform } from 'os';
import * as childProcess from 'child_process';
import { promisify } from 'util';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');
jest.mock('child_process');
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => fn)
}));

describe('showImageTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = showImageTool as Required<Tool>;

  // Mock implementations
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;
  const mockPlatform = platform as jest.MockedFunction<typeof platform>;
  const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.resolve.mockImplementation((_, filePath) => `/mock/path/${filePath}`);
    mockPath.extname.mockImplementation((filePath) => {
      const parts = String(filePath).split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    });
  });

  it('should display PNG image on Windows', async () => {
    mockPlatform.mockReturnValue('win32');
    mockFs.access.mockResolvedValue(undefined);
    mockChildProcess.exec.mockImplementation((command: string, options: any, callback?: any) => {
      if (typeof options === 'function') {
        options(null, '', '');
      } else if (callback) {
        callback(null, '', '');
      }
      return {} as childProcess.ChildProcess;
    });

    const result = await tool.execute({
      path: 'test.png'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('Displaying image: test.png');
    expect(mockChildProcess.exec).toHaveBeenCalledWith(
      'start "" "/mock/path/test.png"',
      expect.any(Function)
    );
  });

  it('should display JPEG image on macOS', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockFs.access.mockResolvedValue(undefined);
    mockChildProcess.exec.mockImplementation((command: string, options: any, callback?: any) => {
      if (typeof options === 'function') {
        options(null, '', '');
      } else if (callback) {
        callback(null, '', '');
      }
      return {} as childProcess.ChildProcess;
    });

    const result = await tool.execute({
      path: 'test.jpg'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('Displaying image: test.jpg');
    expect(mockChildProcess.exec).toHaveBeenCalledWith(
      'open "/mock/path/test.jpg"',
      expect.any(Function)
    );
  });

  it('should display image on Linux', async () => {
    mockPlatform.mockReturnValue('linux');
    mockFs.access.mockResolvedValue(undefined);
    mockChildProcess.exec.mockImplementation((command: string, options: any, callback?: any) => {
      if (typeof options === 'function') {
        options(null, '', '');
      } else if (callback) {
        callback(null, '', '');
      }
      return {} as childProcess.ChildProcess;
    });

    const result = await tool.execute({
      path: 'test.png'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('Displaying image: test.png');
    expect(mockChildProcess.exec).toHaveBeenCalledWith(
      'xdg-open "/mock/path/test.png"',
      expect.any(Function)
    );
  });

  it('should handle unsupported platforms', async () => {
    mockPlatform.mockReturnValue('sunos');
    mockFs.access.mockResolvedValue(undefined);

    const result = await tool.execute({
      path: 'test.png'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error displaying image: Unsupported platform: sunos');
    expect(mockChildProcess.exec).not.toHaveBeenCalled();
  });

  it('should handle file not found', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockFs.access.mockRejectedValue(new Error('File not found'));

    const result = await tool.execute({
      path: 'nonexistent.png'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Image file not found at path: nonexistent.png');
    expect(mockChildProcess.exec).not.toHaveBeenCalled();
  });

  it('should handle unsupported image formats', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockFs.access.mockResolvedValue(undefined);

    const result = await tool.execute({
      path: 'test.tiff'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Unsupported image format: .tiff/);
    expect(result.content[0].text).toMatch(/Supported formats:/);
    expect(mockChildProcess.exec).not.toHaveBeenCalled();
  });

  it('should handle exec errors', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockFs.access.mockResolvedValue(undefined);
    mockChildProcess.exec.mockImplementation((command: string, options: any, callback?: any) => {
      if (typeof options === 'function') {
        options(new Error('Failed to open image'), '', '');
      } else if (callback) {
        callback(new Error('Failed to open image'), '', '');
      }
      return {} as childProcess.ChildProcess;
    });

    const result = await tool.execute({
      path: 'test.png'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error displaying image: Failed to open image');
  });

  it('should support all documented formats', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockFs.access.mockResolvedValue(undefined);
    mockChildProcess.exec.mockImplementation((command: string, options: any, callback?: any) => {
      if (typeof options === 'function') {
        options(null, '', '');
      } else if (callback) {
        callback(null, '', '');
      }
      return {} as childProcess.ChildProcess;
    });

    const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

    for (const format of supportedFormats) {
      const result = await tool.execute({
        path: `test${format}`
      }, mockOptions);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe(`Displaying image: test${format}`);
      expect(mockChildProcess.exec).toHaveBeenCalledWith(
        `open "/mock/path/test${format}"`,
        expect.any(Function)
      );
    }
  });
});