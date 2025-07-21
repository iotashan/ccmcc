import React, { useEffect, useRef, memo } from 'react';
import MessageBubble from './MessageBubble';
import ToolUseMessage from './ToolUseMessage';
import ClaudeStatus from '../ClaudeStatus';
import TodoList from '../TodoList';
import { TEST_IDS } from '../../utils/testIds';

const MessageComponent = memo(({ 
  message, 
  index, 
  prevMessage, 
  onFileOpen, 
  onShowSettings, 
  autoExpandTools, 
  showRawParameters 
}) => {
  const isGrouped = prevMessage && 
                   prevMessage.type === message.type && 
                   prevMessage.type === 'assistant' && 
                   !prevMessage.isToolUse && 
                   !message.isToolUse;

  return (
    <div
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} ${
        message.type === 'user' ? 'flex justify-end px-3 sm:px-0' : 'px-3 sm:px-0'
      }`}
      data-testid={TEST_IDS.chat.message}
    >
      {message.isToolUse ? (
        <ToolUseMessage
          message={message}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
        />
      ) : message.type === 'todo' ? (
        <TodoList todos={message.todos} timestamp={message.timestamp} />
      ) : message.type === 'claude-status' ? (
        <ClaudeStatus
          status={message.status}
          timestamp={message.timestamp}
          details={message.details}
          showSettings={onShowSettings}
        />
      ) : message.type === 'system' ? (
        <div className="system-message bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 my-2">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {message.content}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      ) : message.type === 'permission-request' ? (
        <div className="permission-request bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 my-2">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Permission Required
              </h4>
              {(() => {
                const lines = message.content.split('\n').filter(line => line.trim());
                const questionLine = lines.find(line => line.includes('?')) || lines[0] || '';
                const options = [];
                
                lines.forEach(line => {
                  if (line.match(/^[a-z]\)/)) {
                    options.push(line);
                  }
                });

                return (
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                      {questionLine}
                    </p>
                    {options.length > 0 && (
                      <div className="space-y-1">
                        {options.map((option, idx) => (
                          <div key={idx} className="text-sm text-amber-700 dark:text-amber-300 pl-4">
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <MessageBubble
          message={message}
          isGrouped={isGrouped}
          onFileOpen={onFileOpen}
          showRawParameters={showRawParameters}
        />
      )}
    </div>
  );
});

const MessageList = ({ 
  messages, 
  isLoading, 
  onFileOpen, 
  onShowSettings, 
  autoExpandTools, 
  showRawParameters, 
  autoScrollToBottom 
}) => {
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (autoScrollToBottom) {
      scrollToBottom();
    }
  }, [messages, autoScrollToBottom]);

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto py-6 space-y-4"
      data-testid={TEST_IDS.chat.messageList}
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-lg font-medium mb-2">Start a conversation</p>
          <p className="text-sm text-center max-w-md">
            Ask Claude about your code, get help with debugging, or explore architectural decisions.
          </p>
        </div>
      )}

      {messages.map((message, index) => (
        <MessageComponent
          key={message.id || index}
          message={message}
          index={index}
          prevMessage={index > 0 ? messages[index - 1] : null}
          onFileOpen={onFileOpen}
          onShowSettings={onShowSettings}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
        />
      ))}

      {isLoading && (
        <div className="flex items-center space-x-2 px-3 sm:px-0">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-sm">
            C
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;