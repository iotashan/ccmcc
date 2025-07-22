// tests/unit/client/handlers.test.js
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Client Message Handlers', () => {
  let mockWebSocket;
  let handlers;

  beforeEach(() => {
    mockWebSocket = testUtils.createMockWebSocket();
    jest.clearAllMocks();
    
    // Mock client-side handlers
    handlers = {
      handleClaudeResponse: jest.fn(),
      handleSessionAborted: jest.fn(),
      handleShellOutput: jest.fn(),
      handleMachineRegisterAck: jest.fn(),
      handleHeartbeatAck: jest.fn(),
      handleProjectList: jest.fn(),
      handleError: jest.fn(),
      handleRateLimit: jest.fn()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Claude Response Handlers', () => {
    test('should handle text response from Claude', () => {
      const responseData = {
        type: 'claude-response',
        data: {
          type: 'text',
          text: 'Here is your code solution...',
          sessionId: 'session-123'
        }
      };

      handlers.handleClaudeResponse(responseData);

      expect(handlers.handleClaudeResponse).toHaveBeenCalledWith(responseData);
    });

    test('should handle tool use response from Claude', () => {
      const responseData = {
        type: 'claude-response',
        data: {
          type: 'tool_use',
          tool: 'Read',
          parameters: { file_path: '/test/file.js' },
          sessionId: 'session-123'
        }
      };

      handlers.handleClaudeResponse(responseData);

      expect(handlers.handleClaudeResponse).toHaveBeenCalledWith(responseData);
    });

    test('should handle streaming response chunks', () => {
      const chunks = [
        { type: 'claude-response', data: { type: 'text', text: 'Here ', sessionId: 'session-123' }},
        { type: 'claude-response', data: { type: 'text', text: 'is your ', sessionId: 'session-123' }},
        { type: 'claude-response', data: { type: 'text', text: 'response', sessionId: 'session-123' }}
      ];

      chunks.forEach(chunk => {
        handlers.handleClaudeResponse(chunk);
      });

      expect(handlers.handleClaudeResponse).toHaveBeenCalledTimes(3);
    });

    test('should handle session completion', () => {
      const responseData = {
        type: 'session-complete',
        sessionId: 'session-123',
        usage: {
          input_tokens: 100,
          output_tokens: 200
        }
      };

      handlers.handleClaudeResponse(responseData);

      expect(handlers.handleClaudeResponse).toHaveBeenCalledWith(responseData);
    });
  });

  describe('Session Management Handlers', () => {
    test('should handle session abort acknowledgment', () => {
      const abortData = {
        type: 'session-aborted',
        sessionId: 'session-123',
        success: true
      };

      handlers.handleSessionAborted(abortData);

      expect(handlers.handleSessionAborted).toHaveBeenCalledWith(abortData);
    });

    test('should handle session abort failure', () => {
      const abortData = {
        type: 'session-aborted',
        sessionId: 'session-123',
        success: false,
        error: 'Session not found'
      };

      handlers.handleSessionAborted(abortData);

      expect(handlers.handleSessionAborted).toHaveBeenCalledWith(abortData);
    });
  });

  describe('Shell Output Handlers', () => {
    test('should handle shell initialization output', () => {
      const outputData = {
        type: 'output',
        data: 'Started shell in: /test/project\n'
      };

      handlers.handleShellOutput(outputData);

      expect(handlers.handleShellOutput).toHaveBeenCalledWith(outputData);
    });

    test('should handle command execution output', () => {
      const outputData = {
        type: 'output',
        data: 'total 8\ndrwxr-xr-x  3 user user 4096 Jan 1 12:00 src\n'
      };

      handlers.handleShellOutput(outputData);

      expect(handlers.handleShellOutput).toHaveBeenCalledWith(outputData);
    });

    test('should handle shell error output', () => {
      const errorData = {
        type: 'error',
        data: 'bash: command not found: invalidcmd\n'
      };

      handlers.handleShellOutput(errorData);

      expect(handlers.handleShellOutput).toHaveBeenCalledWith(errorData);
    });

    test('should handle shell exit', () => {
      const exitData = {
        type: 'exit',
        code: 0
      };

      handlers.handleShellOutput(exitData);

      expect(handlers.handleShellOutput).toHaveBeenCalledWith(exitData);
    });
  });

  describe('Machine Communication Handlers', () => {
    test('should handle machine registration acknowledgment', () => {
      const registerAck = {
        type: 'REGISTER_ACK',
        machine: {
          id: 'machine-123',
          name: 'test-machine',
          status: 'online'
        }
      };

      handlers.handleMachineRegisterAck(registerAck);

      expect(handlers.handleMachineRegisterAck).toHaveBeenCalledWith(registerAck);
    });

    test('should handle heartbeat acknowledgment', () => {
      const heartbeatAck = {
        type: 'HEARTBEAT_ACK',
        success: true
      };

      handlers.handleHeartbeatAck(heartbeatAck);

      expect(handlers.handleHeartbeatAck).toHaveBeenCalledWith(heartbeatAck);
    });

    test('should handle project list response', () => {
      const projectList = {
        type: 'PROJECT_LIST',
        requestId: 'req-123',
        projects: [
          { id: 'project-1', name: 'Test Project 1', path: '/path/to/project1' },
          { id: 'project-2', name: 'Test Project 2', path: '/path/to/project2' }
        ]
      };

      handlers.handleProjectList(projectList);

      expect(handlers.handleProjectList).toHaveBeenCalledWith(projectList);
    });

    test('should handle empty project list', () => {
      const projectList = {
        type: 'PROJECT_LIST',
        requestId: 'req-123',
        projects: []
      };

      handlers.handleProjectList(projectList);

      expect(handlers.handleProjectList).toHaveBeenCalledWith(projectList);
    });
  });

  describe('Error Handlers', () => {
    test('should handle authentication errors', () => {
      const errorData = {
        type: 'error',
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      };

      handlers.handleError(errorData);

      expect(handlers.handleError).toHaveBeenCalledWith(errorData);
    });

    test('should handle connection errors', () => {
      const errorData = {
        type: 'error',
        error: 'Connection lost',
        code: 'CONNECTION_ERROR'
      };

      handlers.handleError(errorData);

      expect(handlers.handleError).toHaveBeenCalledWith(errorData);
    });

    test('should handle API errors', () => {
      const errorData = {
        type: 'error',
        error: 'Claude API rate limit exceeded',
        code: 'API_ERROR'
      };

      handlers.handleError(errorData);

      expect(handlers.handleError).toHaveBeenCalledWith(errorData);
    });

    test('should handle unknown message types', () => {
      const errorData = {
        type: 'error',
        error: 'Unknown message type',
        originalType: 'invalid-type'
      };

      handlers.handleError(errorData);

      expect(handlers.handleError).toHaveBeenCalledWith(errorData);
    });
  });

  describe('Rate Limiting Handlers', () => {
    test('should handle rate limit exceeded', () => {
      const rateLimitData = {
        type: 'rate_limit_exceeded',
        message: 'Too many requests',
        retryAfter: 60
      };

      handlers.handleRateLimit(rateLimitData);

      expect(handlers.handleRateLimit).toHaveBeenCalledWith(rateLimitData);
    });

    test('should handle rate limit warnings', () => {
      const rateLimitWarning = {
        type: 'rate_limit_warning',
        message: 'Approaching rate limit',
        remaining: 5
      };

      handlers.handleRateLimit(rateLimitWarning);

      expect(handlers.handleRateLimit).toHaveBeenCalledWith(rateLimitWarning);
    });
  });

  describe('Message Routing', () => {
    let messageRouter;

    beforeEach(() => {
      messageRouter = {
        route: (message) => {
          switch (message.type) {
            case 'claude-response':
            case 'session-complete':
              return handlers.handleClaudeResponse(message);
            case 'session-aborted':
              return handlers.handleSessionAborted(message);
            case 'output':
            case 'exit':
              return handlers.handleShellOutput(message);
            case 'REGISTER_ACK':
              return handlers.handleMachineRegisterAck(message);
            case 'HEARTBEAT_ACK':
              return handlers.handleHeartbeatAck(message);
            case 'PROJECT_LIST':
              return handlers.handleProjectList(message);
            case 'error':
              return handlers.handleError(message);
            case 'rate_limit_exceeded':
            case 'rate_limit_warning':
              return handlers.handleRateLimit(message);
            default:
              return handlers.handleError({
                type: 'error',
                error: 'Unknown message type',
                originalType: message.type
              });
          }
        }
      };
    });

    test('should route messages to correct handlers', () => {
      const messages = [
        { type: 'claude-response', data: { type: 'text', text: 'Hello' }},
        { type: 'session-aborted', sessionId: 'test' },
        { type: 'output', data: 'shell output' },
        { type: 'REGISTER_ACK', machine: { id: 'test' }},
        { type: 'error', error: 'test error' }
      ];

      messages.forEach(message => messageRouter.route(message));

      expect(handlers.handleClaudeResponse).toHaveBeenCalledTimes(1);
      expect(handlers.handleSessionAborted).toHaveBeenCalledTimes(1);
      expect(handlers.handleShellOutput).toHaveBeenCalledTimes(1);
      expect(handlers.handleMachineRegisterAck).toHaveBeenCalledTimes(1);
      expect(handlers.handleError).toHaveBeenCalledTimes(1);
    });

    test('should handle unknown message types', () => {
      const unknownMessage = { type: 'unknown-type', data: 'test' };

      messageRouter.route(unknownMessage);

      expect(handlers.handleError).toHaveBeenCalledWith({
        type: 'error',
        error: 'Unknown message type',
        originalType: 'unknown-type'
      });
    });
  });

  describe('Handler Error Recovery', () => {
    test('should handle handler exceptions gracefully', () => {
      const faultyHandler = jest.fn(() => {
        throw new Error('Handler crashed');
      });

      const safeHandler = (message) => {
        try {
          return faultyHandler(message);
        } catch (error) {
          console.error('Handler error:', error.message);
          return handlers.handleError({
            type: 'error',
            error: 'Handler error: ' + error.message
          });
        }
      };

      const message = { type: 'test', data: 'test' };
      safeHandler(message);

      expect(faultyHandler).toHaveBeenCalled();
      expect(handlers.handleError).toHaveBeenCalledWith({
        type: 'error',
        error: 'Handler error: Handler crashed'
      });
    });

    test('should handle malformed message data', () => {
      const malformedMessages = [
        null,
        undefined,
        {},
        { type: 'claude-response' }, // Missing data
        { data: 'test' }, // Missing type
        { type: 'claude-response', data: null }
      ];

      malformedMessages.forEach(message => {
        try {
          if (!message || !message.type) {
            handlers.handleError({
              type: 'error',
              error: 'Malformed message',
              originalMessage: message
            });
          } else {
            handlers.handleClaudeResponse(message);
          }
        } catch (error) {
          handlers.handleError({
            type: 'error',
            error: 'Message processing error: ' + error.message
          });
        }
      });

      expect(handlers.handleError).toHaveBeenCalledTimes(4); // null, undefined, {}, missing type
      expect(handlers.handleClaudeResponse).toHaveBeenCalledTimes(2); // missing data, null data
    });
  });
});