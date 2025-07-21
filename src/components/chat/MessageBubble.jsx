import React from 'react';
import ReactMarkdown from 'react-markdown';
import { TEST_IDS } from '../../utils/testIds';

const MessageBubble = ({ message, isGrouped, onFileOpen, showRawParameters }) => {
  const messageRef = React.useRef(null);
  
  if (message.type === 'user') {
    return (
      <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
          {message.images && message.images.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {message.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.data}
                  alt={img.name}
                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(img.data, '_blank')}
                />
              ))}
            </div>
          )}
          <div className="text-xs text-blue-100 mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
        {!isGrouped && (
          <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
            U
          </div>
        )}
      </div>
    );
  }

  // Assistant message with proper terminal-style formatting for bash commands
  const formatBashOutput = (content) => {
    // Check if this is a bash command output
    if (content.includes('<bash-input>') || content.includes('<bash-stdout>')) {
      // Parse bash tags with multi-line support
      const elements = [];
      let currentPos = 0;
      let elementKey = 0;
      
      // Process bash-input tags
      const inputRegex = /<bash-input>([\s\S]*?)<\/bash-input>/g;
      const stdoutRegex = /<bash-stdout>([\s\S]*?)<\/bash-stdout>/g;
      
      // Collect all matches with their positions
      const matches = [];
      let match;
      
      // Reset regex lastIndex to ensure proper matching
      inputRegex.lastIndex = 0;
      stdoutRegex.lastIndex = 0;
      
      while ((match = inputRegex.exec(content)) !== null) {
        matches.push({
          type: 'input',
          content: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      while ((match = stdoutRegex.exec(content)) !== null) {
        matches.push({
          type: 'stdout',
          content: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      // Sort matches by position
      matches.sort((a, b) => a.start - b.start);
      
      // Build elements array
      for (const match of matches) {
        // Add any text before this match
        if (currentPos < match.start) {
          const text = content.substring(currentPos, match.start).trim();
          if (text) {
            elements.push(
              <div key={`text-${elementKey++}`} className="text-sm mb-2">
                {text}
              </div>
            );
          }
        }
        
        // Add the matched element
        if (match.type === 'input') {
          elements.push(
            <div key={`cmd-${elementKey++}`} className="flex items-start space-x-2 font-mono text-sm mb-1">
              <span className="text-green-500 select-none">$</span>
              <span className="text-gray-100 whitespace-pre-wrap">{match.content}</span>
            </div>
          );
        } else if (match.type === 'stdout') {
          // Show stdout even if empty (command may have no output)
          elements.push(
            <div key={`out-${elementKey++}`} className="font-mono text-sm text-gray-300 ml-6 whitespace-pre-wrap">
              {match.content || '(no output)'}
            </div>
          );
        }
        
        currentPos = match.end;
      }
      
      // Add any remaining text
      if (currentPos < content.length) {
        const text = content.substring(currentPos).trim();
        if (text) {
          elements.push(
            <div key={`text-${elementKey++}`} className="text-sm mt-2">
              {text}
            </div>
          );
        }
      }
      
      return (
        <div className="bg-gray-900 rounded-lg p-3 my-2 overflow-x-auto">
          {elements.length > 0 ? elements : <div className="text-gray-500">No output</div>}
        </div>
      );
    }
    
    // Not a bash output, return as-is
    return content;
  };

  // Render assistant message content
  const renderContent = () => {
    const formattedContent = formatBashOutput(message.content || '');
    
    if (typeof formattedContent === 'string') {
      return (
        <ReactMarkdown
          components={{
            pre: ({ children }) => (
              <div className="relative">
                <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
                  {children}
                </pre>
              </div>
            ),
            code: ({ inline, children }) => 
              inline ? (
                <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              ) : (
                <div>{children}</div>
              ),
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => {
                  if (href?.startsWith('file://')) {
                    e.preventDefault();
                    const filePath = href.replace('file://', '');
                    onFileOpen?.(filePath);
                  }
                }}
              >
                {children}
              </a>
            )
          }}
        >
          {formattedContent}
        </ReactMarkdown>
      );
    }
    
    return formattedContent;
  };

  return (
    <div ref={messageRef} className="flex items-start space-x-3">
      {!isGrouped && (
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
          C
        </div>
      )}
      <div className={`flex-1 ${isGrouped ? 'ml-11' : ''}`}>
        {!isGrouped && (
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Claude
          </div>
        )}
        <div className="text-gray-800 dark:text-gray-100">
          {renderContent()}
        </div>
        <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isGrouped ? 'opacity-0 group-hover:opacity-100' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;