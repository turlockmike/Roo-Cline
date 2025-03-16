import { MemoryThreadStorage } from '../memory-storage';
import { Thread } from '../thread';
describe('MemoryStorage', () => {
  let storage: MemoryThreadStorage;

  beforeEach(() => {
    storage = new MemoryThreadStorage();
  });

  test('creates a new thread', () => {
    const thread = storage.create();
    expect(thread).toBeInstanceOf(Thread);
    expect(thread.id).toBeDefined();
  });

  test('creates a thread with specific id', () => {
    const threadId = 'test-thread-id';
    const thread = storage.create(threadId);
    expect(thread.id).toBe(threadId);
  });

  test('saves and loads a thread', async () => {
    const thread = storage.create();
    thread.addMessage('user', 'test message');
    await thread.save();

    const loaded = storage.load(thread.id);
    expect(loaded.getMessages()).toHaveLength(1);
    expect(loaded.getMessages()[0].content).toBe('test message');
  });

  test('throws when loading non-existent thread', () => {
    expect(() => storage.load('non-existent')).toThrow('Thread not found');
  });

  test('deletes a thread', async () => {
    const thread = storage.create();
    await thread.save();
    
    expect(storage.delete(thread.id)).toBe(true);
    expect(() => storage.load(thread.id)).toThrow('Thread not found');
  });

  test('lists all thread ids', async () => {
    const thread1 = storage.create();
    const thread2 = storage.create();
    await thread1.save();
    await thread2.save();

    const ids = storage.list();
    expect(ids).toContain(thread1.id);
    expect(ids).toContain(thread2.id);
  });

  test('clears all threads', async () => {
    const thread1 = storage.create();
    const thread2 = storage.create();
    await thread1.save();
    await thread2.save();

    storage.clear();
    expect(storage.list()).toHaveLength(0);
  });
});
