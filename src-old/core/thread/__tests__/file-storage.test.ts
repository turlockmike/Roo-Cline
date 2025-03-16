import { FileSystemStorage } from '../file-storage';
import { Thread } from '../thread';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';


describe('FileSystemStorage', () => {
  const testDir = path.join(__dirname, 'test-threads');
  
  beforeEach(async () => {
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true });
    }
  });

  test('creates a new thread', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    expect(thread).toBeInstanceOf(Thread);
    expect(thread.id).toBeDefined();
  });

  test('throws when creating thread with existing file', async () => {
    const filePath = path.join(testDir, 'thread.json');
    await fs.writeFile(filePath, '{}');
    
    await expect(FileSystemStorage.create(filePath)).rejects.toThrow('thread already exists');
  });

  test('saves and loads a thread', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    thread.addMessage('user', 'test message');
    await thread.save();

    const loaded = await FileSystemStorage.load(filePath);
    expect(loaded.getMessages()).toHaveLength(1);
    expect(loaded.getMessages()[0].content).toBe('test message');
  });

  test('throws when loading non-existent file', async () => {
    const filePath = path.join(testDir, 'non-existent.json');
    await expect(FileSystemStorage.load(filePath)).rejects.toThrow();
  });

  test('handles complex data types', async () => {
    const filePath = path.join(testDir, 'thread.json');
    const thread = await FileSystemStorage.create(filePath);
    
    // Test Map
    thread.addContext('test', { value: 123 });
    
    // Test Buffer
    thread.addFileContext({
      key: 'file',
      content: Buffer.from('test content'),
      filename: 'test.txt',
      mimeType: 'text/plain'
    });

    await thread.save();

    const loaded = await FileSystemStorage.load(filePath);
    expect(loaded.getContext('test')?.value).toEqual({ value: 123 });
    
    const fileContext = loaded.getContext('file');
    expect(fileContext?.type).toBe('file');
    expect(Buffer.isBuffer(fileContext?.value.content)).toBe(true);
    expect(fileContext?.value.content.toString()).toBe('test content');
  });
}); 