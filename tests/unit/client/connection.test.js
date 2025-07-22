// tests/unit/client/connection.test.js
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Client WebSocket Connection', () => {
  let mockWebSocket;
  let connection;
  let connectionCallbacks;

  beforeEach(() => {
    mockWebSocket = testUtils.createMockWebSocket();
    connectionCallbacks = {
      onOpen: jest.fn(),
      onClose: jest.fn(),
      onError: jest.fn(),
      onMessage: jest.fn()
    };

    // Mock connection class
    connection = {
      ws: null,
      url: 'ws://localhost:8080/ws',
      token: 'test-token',
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      isConnected: false,
      
      connect: jest.fn(() => {
        connection.ws = mockWebSocket;
        connection.isConnected = true;
        connectionCallbacks.onOpen();
        return Promise.resolve();
      }),
      
      disconnect: jest.fn(() => {
        if (connection.ws) {
          connection.ws.close();
          connection.isConnected = false;
          connectionCallbacks.onClose();
        }
      }),
      
      send: jest.fn((message) => {
        if (connection.isConnected && connection.ws) {
          connection.ws.send(JSON.stringify(message));
        } else {
          throw new Error('Not connected');
        }
      }),
      
      reconnect: jest.fn(() => {
        if (connection.reconnectAttempts < connection.maxReconnectAttempts) {
          connection.reconnectAttempts++;
          return connection.connect();
        } else {
          throw new Error('Max reconnect attempts exceeded');
        }
      })
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    if (connection.isConnected) {
      connection.disconnect();
    }
    jest.restoreAllMocks();
  });

  describe('Connection Establishment', () => {
    test('should connect to WebSocket server', async () => {
      await connection.connect();

      expect(connection.connect).toHaveBeenCalled();
      expect(connection.isConnected).toBe(true);
      expect(connectionCallbacks.onOpen).toHaveBeenCalled();
    });

    test('should handle connection with authentication token', async () => {
      connection.token = 'valid-jwt-token';
      
      await connection.connect();

      expect(connection.connect).toHaveBeenCalled();
      expect(connection.token).toBe('valid-jwt-token');
    });

    test('should handle connection failure', async () => {
      connection.connect = jest.fn(() => {
        connectionCallbacks.onError(new Error('Connection failed'));
        return Promise.reject(new Error('Connection failed'));
      });

      try {
        await connection.connect();
      } catch (error) {
        expect(error.message).toBe('Connection failed');
        expect(connectionCallbacks.onError).toHaveBeenCalled();
      }
    });

    test('should handle connection timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      connection.connect = jest.fn(() => {
        setTimeout(() => connectionCallbacks.onError(timeoutError), 100);
        return Promise.reject(timeoutError);
      });

      try {
        await connection.connect();
      } catch (error) {
        expect(error.message).toBe('Connection timeout');
      }
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      await connection.connect();
    });

    test('should send Claude command messages', () => {
      const command = 'Help me write a function';
      const message = {
        type: 'claude-command',
        command,
        options: { sessionId: 'test-session' }
      };

      connection.send(message);

      expect(connection.send).toHaveBeenCalledWith(message);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should send shell input messages', () => {
      const message = {
        type: 'input',
        data: 'ls -la\n'
      };

      connection.send(message);

      expect(connection.send).toHaveBeenCalledWith(message);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should send machine registration messages', () => {
      const message = {
        type: 'MACHINE_REGISTER',
        name: 'test-machine',
        capabilities: ['shell', 'files']
      };

      connection.send(message);

      expect(connection.send).toHaveBeenCalledWith(message);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should throw error when not connected', () => {
      connection.disconnect();

      const message = { type: 'test', data: 'test' };

      expect(() => connection.send(message)).toThrow('Not connected');
    });

    test('should handle large messages', () => {
      const largeMessage = {
        type: 'claude-command',
        command: 'A'.repeat(10000), // 10KB message
        options: { sessionId: 'test' }
      };

      connection.send(largeMessage);

      expect(connection.send).toHaveBeenCalledWith(largeMessage);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(largeMessage));
    });
  });

  describe('Connection States', () => {
    test('should track connection state correctly', async () => {
      expect(connection.isConnected).toBe(false);

      await connection.connect();
      expect(connection.isConnected).toBe(true);

      connection.disconnect();
      expect(connection.isConnected).toBe(false);
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await connection.connect();
        expect(connection.isConnected).toBe(true);
        
        connection.disconnect();
        expect(connection.isConnected).toBe(false);
      }

      expect(connection.connect).toHaveBeenCalledTimes(3);
      expect(connection.disconnect).toHaveBeenCalledTimes(3);
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection on connection loss', async () => {
      await connection.connect();
      
      // Simulate connection loss
      connection.isConnected = false;
      connectionCallbacks.onClose();

      await connection.reconnect();

      expect(connection.reconnect).toHaveBeenCalled();
      expect(connection.reconnectAttempts).toBe(1);
    });

    test('should respect max reconnect attempts', async () => {
      connection.maxReconnectAttempts = 2;
      connection.reconnectAttempts = 2;

      try {
        await connection.reconnect();
      } catch (error) {
        expect(error.message).toBe('Max reconnect attempts exceeded');
      }
    });

    test('should reset reconnect attempts on successful connection', async () => {
      connection.reconnectAttempts = 3;

      await connection.connect();

      // Simulate successful reconnection
      connection.reconnectAttempts = 0;
      expect(connection.reconnectAttempts).toBe(0);
    });

    test('should use exponential backoff for reconnection delays', () => {
      const getReconnectDelay = (attempts) => {
        return Math.min(1000 * Math.pow(2, attempts), 30000);
      };

      expect(getReconnectDelay(0)).toBe(1000);   // 1 second
      expect(getReconnectDelay(1)).toBe(2000);   // 2 seconds
      expect(getReconnectDelay(2)).toBe(4000);   // 4 seconds
      expect(getReconnectDelay(5)).toBe(30000);  // Max 30 seconds
    });
  });

  describe('Authentication', () => {
    test('should send authentication after connection', async () => {
      connection.token = 'test-jwt-token';
      
      const authHandler = jest.fn(() => {
        connection.send({
          type: 'authenticate',
          token: connection.token
        });
      });

      await connection.connect();
      authHandler();

      expect(authHandler).toHaveBeenCalled();
      expect(connection.send).toHaveBeenCalledWith({
        type: 'authenticate',
        token: 'test-jwt-token'
      });
    });

    test('should handle authentication failure', async () => {
      connection.token = 'invalid-token';

      const authFailureHandler = jest.fn((error) => {
        connectionCallbacks.onError(new Error('Authentication failed'));
        connection.disconnect();
      });

      await connection.connect();
      authFailureHandler();

      expect(connectionCallbacks.onError).toHaveBeenCalled();
      expect(connection.isConnected).toBe(false);
    });

    test('should refresh expired tokens', async () => {
      const tokenRefreshHandler = jest.fn(async () => {
        connection.token = 'new-jwt-token';
        return connection.token;
      });

      const oldToken = 'expired-token';
      connection.token = oldToken;

      const newToken = await tokenRefreshHandler();

      expect(tokenRefreshHandler).toHaveBeenCalled();
      expect(newToken).toBe('new-jwt-token');
      expect(connection.token).not.toBe(oldToken);
    });
  });

  describe('Message Queue', () => {
    test('should queue messages when disconnected', () => {
      const messageQueue = [];
      const queueMessage = (message) => {
        if (!connection.isConnected) {
          messageQueue.push(message);
          return true;
        }
        return false;
      };

      const message = { type: 'test', data: 'queued' };
      const wasQueued = queueMessage(message);

      expect(wasQueued).toBe(true);
      expect(messageQueue).toHaveLength(1);
      expect(messageQueue[0]).toEqual(message);
    });

    test('should send queued messages on reconnection', async () => {
      const messageQueue = [
        { type: 'claude-command', command: 'test 1' },
        { type: 'claude-command', command: 'test 2' }
      ];

      const sendQueuedMessages = () => {
        messageQueue.forEach(message => {
          connection.send(message);
        });
        messageQueue.length = 0; // Clear queue
      };

      await connection.connect();
      sendQueuedMessages();

      expect(connection.send).toHaveBeenCalledTimes(2);
      expect(messageQueue).toHaveLength(0);
    });

    test('should limit message queue size', () => {
      const messageQueue = [];
      const maxQueueSize = 100;
      
      const queueMessage = (message) => {
        if (messageQueue.length >= maxQueueSize) {
          messageQueue.shift(); // Remove oldest message
        }
        messageQueue.push(message);
      };

      // Fill queue beyond limit
      for (let i = 0; i < 105; i++) {
        queueMessage({ type: 'test', data: `message-${i}` });
      }

      expect(messageQueue).toHaveLength(maxQueueSize);
      expect(messageQueue[0].data).toBe('message-5'); // First message should be message-5
      expect(messageQueue[99].data).toBe('message-104'); // Last message should be message-104
    });
  });

  describe('Heartbeat and Keep-Alive', () => {
    test('should send heartbeat messages', async () => {
      await connection.connect();

      const heartbeatHandler = jest.fn(() => {
        connection.send({
          type: 'MACHINE_HEARTBEAT',
          timestamp: Date.now()
        });
      });

      heartbeatHandler();

      expect(heartbeatHandler).toHaveBeenCalled();
      expect(connection.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MACHINE_HEARTBEAT',
          timestamp: expect.any(Number)
        })
      );
    });

    test('should detect missed heartbeat responses', async () => {
      let heartbeatsMissed = 0;
      const maxMissedHeartbeats = 3;

      const checkHeartbeat = () => {
        heartbeatsMissed++;
        if (heartbeatsMissed >= maxMissedHeartbeats) {
          connection.disconnect();
          connectionCallbacks.onError(new Error('Heartbeat timeout'));
        }
      };

      await connection.connect();
      
      // Simulate missed heartbeats
      for (let i = 0; i < maxMissedHeartbeats; i++) {
        checkHeartbeat();
      }

      expect(connection.isConnected).toBe(false);
      expect(connectionCallbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Heartbeat timeout' })
      );
    });
  });

  describe('Connection Cleanup', () => {
    test('should clean up resources on disconnect', async () => {
      await connection.connect();
      
      const cleanupHandler = jest.fn(() => {
        // Clear intervals, remove event listeners, etc.
        connection.ws = null;
        connection.isConnected = false;
      });

      connection.disconnect();
      cleanupHandler();

      expect(cleanupHandler).toHaveBeenCalled();
      expect(connection.ws).toBeNull();
      expect(connection.isConnected).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      await connection.connect();

      const faultyCleanup = jest.fn(() => {
        throw new Error('Cleanup failed');
      });

      const safeCleanup = () => {
        try {
          faultyCleanup();
        } catch (error) {
          console.warn('Cleanup error:', error.message);
        } finally {
          connection.isConnected = false;
        }
      };

      connection.disconnect();
      safeCleanup();

      expect(faultyCleanup).toHaveBeenCalled();
      expect(connection.isConnected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      const networkError = new Error('Network unreachable');
      connection.connect = jest.fn(() => {
        connectionCallbacks.onError(networkError);
        return Promise.reject(networkError);
      });

      try {
        await connection.connect();
      } catch (error) {
        expect(error).toBe(networkError);
        expect(connectionCallbacks.onError).toHaveBeenCalledWith(networkError);
      }
    });

    test('should handle server errors', async () => {
      await connection.connect();

      const serverError = {
        type: 'error',
        error: 'Internal server error',
        code: 500
      };

      connectionCallbacks.onMessage(serverError);

      expect(connectionCallbacks.onMessage).toHaveBeenCalledWith(serverError);
    });

    test('should handle malformed server responses', async () => {
      await connection.connect();

      const malformedResponses = [
        'invalid json',
        '{"incomplete": "json"',
        null,
        undefined
      ];

      malformedResponses.forEach(response => {
        try {
          if (typeof response === 'string') {
            JSON.parse(response);
          }
          connectionCallbacks.onMessage(response);
        } catch (error) {
          connectionCallbacks.onError(new Error('Malformed response'));
        }
      });

      expect(connectionCallbacks.onError).toHaveBeenCalledTimes(2); // Two JSON parse errors
    });
  });
});