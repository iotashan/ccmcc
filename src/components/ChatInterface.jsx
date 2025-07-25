/*
 * ChatInterface.jsx - Chat Component with Session Protection Integration
 * 
 * SESSION PROTECTION INTEGRATION:
 * ===============================
 * 
 * This component integrates with the Session Protection System to prevent project updates
 * from interrupting active conversations:
 * 
 * Key Integration Points:
 * 1. handleSubmit() - Marks session as active when user sends message (including temp ID for new sessions)
 * 2. session-created handler - Replaces temporary session ID with real WebSocket session ID  
 * 3. claude-complete handler - Marks session as inactive when conversation finishes
 * 4. session-aborted handler - Marks session as inactive when conversation is aborted
 * 
 * This ensures uninterrupted chat experience by coordinating with App.jsx to pause sidebar updates.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MessageList from './chat/MessageList';
import MessageInput from './chat/MessageInput';
import ClaudeLogo from './ClaudeLogo.jsx';
import { api } from '../utils/api';
import { TEST_IDS } from '../utils/testIds';
import { safeLocalStorage } from '../utils/safeLocalStorage';

// Helper function to convert WebSocket messages to display format
function convertWebSocketMessages(rawMessages) {
  const converted = [];
  const toolResults = new Map();
  
  // First pass: collect tool results
  for (const msg of rawMessages) {
    if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
      for (const part of msg.message.content) {
        if (part.type === 'tool_result') {
          toolResults.set(part.tool_use_id, {
            result: part.content,
            is_error: part.is_error
          });
        }
      }
    }
  }
  
  // Second pass: convert messages
  for (const msg of rawMessages) {
    // Handle user messages
    if (msg.message?.role === 'user' && msg.message?.content) {
      let content = '';
      let messageType = 'user';
      
      if (Array.isArray(msg.message.content)) {
        // Handle array content, but skip tool results (they're attached to tool uses)
        const textParts = [];
        
        for (const part of msg.message.content) {
          if (part.type === 'text') {
            textParts.push(part.text);
          }
        }
        
        content = textParts.join('\n');
      } else if (typeof msg.message.content === 'string') {
        content = msg.message.content;
      } else {
        content = String(msg.message.content);
      }
      
      if (content) {
        converted.push({
          type: messageType,
          content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }
    
    // Handle assistant messages
    else if (msg.message?.role === 'assistant' && msg.message?.content) {
      if (Array.isArray(msg.message.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'text') {
            converted.push({
              type: 'assistant',
              content: part.text,
              timestamp: msg.timestamp || new Date().toISOString()
            });
          } else if (part.type === 'tool_use') {
            const toolResult = toolResults.get(part.id);
            converted.push({
              type: 'assistant',
              isToolUse: true,
              toolName: part.name,
              parameters: part.input,
              result: toolResult?.result,
              status: toolResult ? (toolResult.is_error ? 'error' : 'success') : 'pending',
              timestamp: msg.timestamp || new Date().toISOString()
            });
          }
        }
      } else if (typeof msg.message.content === 'string') {
        converted.push({
          type: 'assistant',
          content: msg.message.content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }
    
    // Handle other message types
    else if (msg.type) {
      if (msg.type === 'todo-update' && msg.todos) {
        converted.push({
          type: 'todo',
          todos: msg.todos,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      } else if (msg.type === 'claude-status' && msg.status) {
        converted.push({
          type: 'claude-status',
          status: msg.status,
          details: msg.details,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      } else if (msg.type === 'system' && msg.content) {
        converted.push({
          type: 'system',
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      } else if (msg.type === 'permission-request' && msg.content) {
        converted.push({
          type: 'permission-request',
          content: msg.content,
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
    }
  }
  
  return converted;
}

// ChatInterface: Main chat component with Session Protection System integration
// 
// Session Protection System prevents automatic project updates from interrupting active conversations:
// - onSessionActive: Called when user sends message to mark session as protected
// - onSessionInactive: Called when conversation completes/aborts to re-enable updates
// - onReplaceTemporarySession: Called to replace temporary session ID with real WebSocket session ID
//
// This ensures uninterrupted chat experience by pausing sidebar refreshes during conversations.
function ChatInterface({
  selectedProject, 
  selectedSession, 
  ws, 
  sendMessage, 
  messages, 
  onFileOpen, 
  onInputFocusChange, 
  onSessionActive, 
  onSessionInactive, 
  onReplaceTemporarySession, 
  onNavigateToSession, 
  onShowSettings,
  onUpdateSessionSummary, 
  autoExpandTools, 
  showRawParameters, 
  autoScrollToBottom, 
  selectedMachine,
  sendByCtrlEnter
}) {
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      return safeLocalStorage.getItem(`draft_input_${selectedProject.name}`) || '';
    }
    return '';
  });
  const [chatMessages, setChatMessages] = useState(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      const saved = safeLocalStorage.getItem(`chat_messages_${selectedProject.name}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false);
  const [isSystemSessionChange, setIsSystemSessionChange] = useState(false);
  const [permissionMode, setPermissionMode] = useState('default');
  const [attachedImages, setAttachedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(new Map());
  const [imageErrors, setImageErrors] = useState(new Map());
  const [projectFiles, setProjectFiles] = useState([]);
  const [isEditingSessionName, setIsEditingSessionName] = useState(false);
  const [editedSessionName, setEditedSessionName] = useState('');
  
  const scrollContainerRef = useRef(null);
  const tempSessionIdRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Load project files for @ mentions
  useEffect(() => {
    if (selectedProject) {
      // This would typically fetch from an API
      // For now, using a mock implementation
      setProjectFiles([
        'src/App.jsx',
        'src/components/ChatInterface.jsx',
        'src/components/chat/MessageBubble.jsx',
        'src/components/chat/MessageInput.jsx',
        'src/components/chat/MessageList.jsx',
        'src/components/chat/ToolUseMessage.jsx',
        'src/utils/api.js',
        'package.json',
        'README.md'
      ]);
    }
  }, [selectedProject]);

  // Save draft input to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      const timeoutId = setTimeout(() => {
        if (input) {
          safeLocalStorage.setItem(`draft_input_${selectedProject.name}`, input);
        } else {
          safeLocalStorage.removeItem(`draft_input_${selectedProject.name}`);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [input, selectedProject]);

  // Persist chat messages to localStorage (with automatic truncation)
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedProject && chatMessages.length > 0) {
      safeLocalStorage.setItem(`chat_messages_${selectedProject.name}`, JSON.stringify(chatMessages));
    }
  }, [chatMessages, selectedProject]);

  // Load session messages from API
  const loadSessionMessages = useCallback(async (sessionId) => {
    if (!selectedProject || !sessionId) return;
    
    setIsLoadingSessionMessages(true);
    try {
      const response = await api.getSessionMessages(
        selectedProject.name,
        sessionId,
        selectedMachine?.id
      );
      
      if (response.messages) {
        const converted = convertWebSocketMessages(response.messages);
        setSessionMessages(converted);
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    } finally {
      setIsLoadingSessionMessages(false);
      setIsSystemSessionChange(false);
    }
  }, [selectedProject, selectedMachine?.id]);

  // Load session messages when session changes
  useEffect(() => {
    // Load messages when we have a selected session and either:
    // 1. It's the initial load (currentSessionId is null)
    // 2. The session has changed
    if (selectedSession?.id && selectedSession.id !== currentSessionId) {
      // Only mark as system change if it's not the initial load
      if (currentSessionId !== null) {
        setIsSystemSessionChange(true);
      }
      loadSessionMessages(selectedSession.id);
      setCurrentSessionId(selectedSession.id);
    }
  }, [selectedSession?.id, currentSessionId, loadSessionMessages]); // Include all dependencies

  // Handle WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message':
            setChatMessages(prev => [...prev, {
              type: data.message.role,
              content: data.message.content,
              timestamp: new Date().toISOString()
            }]);
            break;
            
          case 'session-created':
            if (tempSessionIdRef.current) {
              onReplaceTemporarySession?.(tempSessionIdRef.current, data.sessionId);
              tempSessionIdRef.current = null;
            }
            setCurrentSessionId(data.sessionId);
            onNavigateToSession?.(data.sessionId);
            break;
            
          case 'claude-complete':
            setIsLoading(false);
            onSessionInactive?.();
            // Clear persisted chat messages after successful completion
            if (selectedProject) {
              safeLocalStorage.removeItem(`chat_messages_${selectedProject.name}`);
            }
            break;
            
          case 'session-aborted':
            setIsLoading(false);
            onSessionInactive?.();
            break;
            
          case 'permission-request':
            setChatMessages(prev => [...prev, {
              type: 'permission-request',
              content: data.content,
              timestamp: new Date().toISOString()
            }]);
            break;
            
          case 'claude-status':
            setChatMessages(prev => [...prev, {
              type: 'claude-status',
              status: data.status,
              details: data.details,
              timestamp: new Date().toISOString()
            }]);
            break;
            
          case 'todo-update':
            setChatMessages(prev => [...prev, {
              type: 'todo',
              todos: data.todos,
              timestamp: new Date().toISOString()
            }]);
            break;
            
          case 'claude-response':
            // Handle Claude's responses which may include tool use results
            if (data.data) {
              const response = data.data;
              
              // Handle tool result messages with bash output
              if (response.message?.role === 'user' && Array.isArray(response.message?.content)) {
                for (const part of response.message.content) {
                  if (part.type === 'tool_result' && part.tool_use_id) {
                    // Find the corresponding tool use message and update it with the result
                    setChatMessages(prev => {
                      const updatedMessages = [...prev];
                      // Look backwards for the most recent tool use with matching ID
                      for (let i = updatedMessages.length - 1; i >= 0; i--) {
                        if (updatedMessages[i].isToolUse && !updatedMessages[i].result) {
                          updatedMessages[i] = {
                            ...updatedMessages[i],
                            result: part.content,
                            status: part.is_error ? 'error' : 'success'
                          };
                          break;
                        }
                      }
                      return updatedMessages;
                    });
                  }
                }
              }
              
              // Handle assistant messages
              else if (response.message?.role === 'assistant' && response.message?.content) {
                if (Array.isArray(response.message.content)) {
                  for (const part of response.message.content) {
                    if (part.type === 'text') {
                      setChatMessages(prev => [...prev, {
                        type: 'assistant',
                        content: part.text,
                        timestamp: new Date().toISOString()
                      }]);
                    } else if (part.type === 'tool_use') {
                      setChatMessages(prev => [...prev, {
                        type: 'assistant',
                        isToolUse: true,
                        toolName: part.name,
                        parameters: part.input,
                        timestamp: new Date().toISOString()
                      }]);
                    }
                  }
                } else if (typeof response.message?.content === 'string') {
                  setChatMessages(prev => [...prev, {
                    type: 'assistant',
                    content: response.message.content,
                    timestamp: new Date().toISOString()
                  }]);
                }
              }
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, onReplaceTemporarySession, onNavigateToSession, onSessionInactive]);

  // Combine session messages with real-time messages
  const displayMessages = useMemo(() => {
    const allMessages = [...sessionMessages, ...chatMessages];
    return allMessages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [sessionMessages, chatMessages]);

  // Handle message submission
  const handleSubmit = async (messageText, images = []) => {
    if (!messageText.trim() || !selectedProject || !ws) return;
    
    setIsLoading(true);
    
    // Create temporary session ID for new sessions
    if (!currentSessionId) {
      tempSessionIdRef.current = `temp-${Date.now()}`;
      onSessionActive?.(tempSessionIdRef.current);
    } else {
      onSessionActive?.(currentSessionId);
    }
    
    // Add user message to display
    const userMessage = {
      type: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
      images: images.length > 0 ? await processImages(images) : undefined
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    
    // Send message via WebSocket
    sendMessage({
      action: 'sendMessage',
      projectPath: selectedProject.path,
      message: messageText,
      permissionMode,
      sessionId: currentSessionId,
      mode: permissionMode,
      images: userMessage.images
    });
  };

  // Process images for upload
  const processImages = async (files) => {
    const processed = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadingImages(prev => new Map(prev).set(i, 0));
      
      try {
        const base64 = await fileToBase64(file);
        processed.push({
          name: file.name,
          data: base64,
          type: file.type
        });
        setUploadingImages(prev => new Map(prev).set(i, 100));
      } catch (error) {
        console.error('Error processing image:', error);
        setImageErrors(prev => new Map(prev).set(i, error.message));
      }
    }
    
    // Clear upload progress after a delay
    setTimeout(() => {
      setUploadingImages(new Map());
      setImageErrors(new Map());
    }, 1000);
    
    return processed;
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file references from @ mentions
  const handleFileReference = (filePath) => {
    console.log('File referenced:', filePath);
    // Could implement file preview or other actions here
  };

  // Handle keyboard events
  const handleKeyDown = (e) => {
    // Handle Enter key: Ctrl+Enter (Cmd+Enter on Mac) sends, Shift+Enter creates new line
    if (e.key === 'Enter') {
      // If we're in composition, don't send message
      if (e.nativeEvent.isComposing) {
        return; // Let IME handle the Enter key
      }
      
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        // Ctrl+Enter or Cmd+Enter: Send message
        e.preventDefault();
        handleSubmit(e);
      } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Plain Enter: Send message only if not in IME composition
        if (!sendByCtrlEnter) {
          e.preventDefault();
          handleSubmit(e);
        }
      }
      // Shift+Enter: Allow default behavior (new line)
    }
  };

  return (
    <>
      {/* Header */}
      <div className="border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <ClaudeLogo size="sm" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {selectedProject ? selectedProject.name : 'Select a Project'}
            </h2>
            {selectedSession && (
              <div className="flex items-center gap-2">
                {isEditingSessionName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editedSessionName}
                      onChange={(e) => setEditedSessionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && onUpdateSessionSummary) {
                          onUpdateSessionSummary(selectedProject.name, selectedSession.id, editedSessionName);
                          setIsEditingSessionName(false);
                        } else if (e.key === 'Escape') {
                          setIsEditingSessionName(false);
                          setEditedSessionName(selectedSession.summary || 'New Session');
                        }
                      }}
                      className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (onUpdateSessionSummary) {
                          onUpdateSessionSummary(selectedProject.name, selectedSession.id, editedSessionName);
                        }
                        setIsEditingSessionName(false);
                      }}
                      className="p-1 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded"
                      title="Save"
                    >
                      <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingSessionName(false);
                        setEditedSessionName(selectedSession.summary || 'New Session');
                      }}
                      className="p-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded"
                      title="Cancel"
                    >
                      <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Session: {selectedSession.summary || 'New Session'}
                    </p>
                    {onUpdateSessionSummary && (
                      <button
                        onClick={() => {
                          setIsEditingSessionName(true);
                          setEditedSessionName(selectedSession.summary || 'New Session');
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Edit session name"
                      >
                        <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setChatMessages([])}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Clear chat"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          <button
            onClick={onShowSettings}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900" data-testid={TEST_IDS.chat.container}>
        <MessageList
          messages={displayMessages}
          isLoading={isLoading}
          onFileOpen={onFileOpen}
          onShowSettings={onShowSettings}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          autoScrollToBottom={autoScrollToBottom}
        />
        
        <MessageInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          permissionMode={permissionMode}
          onPermissionModeChange={setPermissionMode}
          attachedImages={attachedImages}
          onImagesChange={setAttachedImages}
          uploadingImages={uploadingImages}
          imageErrors={imageErrors}
          onFileReference={handleFileReference}
          projectFiles={projectFiles}
          onInputFocusChange={onInputFocusChange}
        />
      </div>
    </>
  );
}

export default ChatInterface;

