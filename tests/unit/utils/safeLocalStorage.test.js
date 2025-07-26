import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeLocalStorage } from '../../../src/utils/safeLocalStorage.js';

describe('safeLocalStorage', () => {
  let mockLocalStorage;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      storage: {},
      getItem: vi.fn((key) => mockLocalStorage.storage[key] || null),
      setItem: vi.fn((key, value) => {
        mockLocalStorage.storage[key] = value;
      }),
      removeItem: vi.fn((key) => {
        delete mockLocalStorage.storage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage.storage = {};
      }),
      get length() {
        return Object.keys(mockLocalStorage.storage).length;
      },
      key: vi.fn((index) => {
        const keys = Object.keys(mockLocalStorage.storage);
        return keys[index] || null;
      })
    };

    // Replace global localStorage with mock
    global.localStorage = mockLocalStorage;
    Object.keys(mockLocalStorage.storage).forEach(key => delete mockLocalStorage.storage[key]);

    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('setItem', () => {
    test('should store items normally when quota is not exceeded', () => {
      safeLocalStorage.setItem('test_key', 'test_value');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test_key', 'test_value');
      expect(mockLocalStorage.storage['test_key']).toBe('test_value');
    });

    test('should truncate chat messages to 50 when storing', () => {
      const messages = Array(100).fill(null).map((_, i) => ({ id: i, content: `Message ${i}` }));
      const messagesJson = JSON.stringify(messages);
      
      safeLocalStorage.setItem('chat_messages_project1', messagesJson);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Truncating chat history for chat_messages_project1 from 100 to 50 messages'
      );
      
      const storedValue = mockLocalStorage.storage['chat_messages_project1'];
      const storedMessages = JSON.parse(storedValue);
      expect(storedMessages).toHaveLength(50);
      expect(storedMessages[0].id).toBe(50); // Should keep the last 50 messages
      expect(storedMessages[49].id).toBe(99);
    });

    test('should handle QuotaExceededError by clearing old chat data', () => {
      // Set up initial chat data for multiple projects
      mockLocalStorage.storage['chat_messages_project1'] = JSON.stringify([{ id: 1 }]);
      mockLocalStorage.storage['chat_messages_project2'] = JSON.stringify([{ id: 2 }]);
      mockLocalStorage.storage['chat_messages_project3'] = JSON.stringify([{ id: 3 }]);
      mockLocalStorage.storage['chat_messages_project4'] = JSON.stringify([{ id: 4 }]);
      mockLocalStorage.storage['chat_messages_project5'] = JSON.stringify([{ id: 5 }]);
      
      // Mock setItem to throw QuotaExceededError on first call
      const originalSetItem = mockLocalStorage.setItem;
      let callCount = 0;
      mockLocalStorage.setItem = vi.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        originalSetItem(key, value);
      });

      // Mock Object.keys to return our storage keys
      const originalObjectKeys = Object.keys;
      Object.keys = vi.fn((obj) => {
        if (obj === localStorage) {
          return originalObjectKeys(mockLocalStorage.storage);
        }
        return originalObjectKeys(obj);
      });

      safeLocalStorage.setItem('chat_messages_project6', JSON.stringify([{ id: 6 }]));

      expect(consoleWarnSpy).toHaveBeenCalledWith('localStorage quota exceeded, clearing old data');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat_messages_project1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat_messages_project2');
      
      // Restore Object.keys
      Object.keys = originalObjectKeys;
    });

    test('should fall back to storing only 10 messages on persistent quota errors', () => {
      const messages = Array(30).fill(null).map((_, i) => ({ id: i, content: `Message ${i}` }));
      const messagesJson = JSON.stringify(messages);
      
      // Mock setItem to always throw QuotaExceededError
      mockLocalStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // Mock Object.keys for the cleanup attempt
      const originalObjectKeys = Object.keys;
      Object.keys = vi.fn(() => []);

      // Create a counter to track setItem calls
      let setItemCallCount = 0;
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = vi.fn((key, value) => {
        setItemCallCount++;
        if (setItemCallCount <= 2) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        // Third call should succeed with truncated data
        mockLocalStorage.storage[key] = value;
      });

      safeLocalStorage.setItem('chat_messages_project1', messagesJson);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Saved only last 10 messages due to quota constraints');
      const finalData = JSON.parse(mockLocalStorage.storage['chat_messages_project1']);
      expect(finalData).toHaveLength(10);
      expect(finalData[0].id).toBe(20); // Last 10 messages
      
      // Restore Object.keys
      Object.keys = originalObjectKeys;
    });

    test('should handle non-quota errors gracefully', () => {
      mockLocalStorage.setItem = vi.fn(() => {
        throw new Error('Some other error');
      });

      safeLocalStorage.setItem('test_key', 'test_value');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage error:', expect.any(Error));
    });
  });

  describe('getItem', () => {
    test('should retrieve items normally', () => {
      mockLocalStorage.storage['test_key'] = 'test_value';
      
      const result = safeLocalStorage.getItem('test_key');
      
      expect(result).toBe('test_value');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test_key');
    });

    test('should handle errors gracefully and return null', () => {
      mockLocalStorage.getItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      const result = safeLocalStorage.getItem('test_key');
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage getItem error:', expect.any(Error));
    });
  });

  describe('removeItem', () => {
    test('should remove items normally', () => {
      mockLocalStorage.storage['test_key'] = 'test_value';
      
      safeLocalStorage.removeItem('test_key');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test_key');
      expect(mockLocalStorage.storage['test_key']).toBeUndefined();
    });

    test('should handle errors gracefully', () => {
      mockLocalStorage.removeItem = vi.fn(() => {
        throw new Error('Remove error');
      });

      safeLocalStorage.removeItem('test_key');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('localStorage removeItem error:', expect.any(Error));
    });
  });

  describe('draft cleanup', () => {
    test('should clean up draft inputs when quota is exceeded', () => {
      // Set up draft data
      mockLocalStorage.storage['draft_input_project1'] = 'draft text 1';
      mockLocalStorage.storage['draft_input_project2'] = 'draft text 2';
      
      // Mock setItem to throw QuotaExceededError on first call
      let callCount = 0;
      mockLocalStorage.setItem = vi.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        mockLocalStorage.storage[key] = value;
      });

      // Mock Object.keys
      const originalObjectKeys = Object.keys;
      Object.keys = vi.fn(() => ['draft_input_project1', 'draft_input_project2']);

      safeLocalStorage.setItem('new_key', 'new_value');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('draft_input_project1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('draft_input_project2');
      
      // Restore Object.keys
      Object.keys = originalObjectKeys;
    });
  });
});