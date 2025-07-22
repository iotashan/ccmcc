import React from 'react';
import ReactMarkdown from 'react-markdown';
import { TEST_IDS } from '../../utils/testIds';

const MessageBubble = ({ message, isGrouped, onFileOpen, showRawParameters }) => {
  const messageRef = React.useRef(null);
  
  // Assistant message with proper terminal-style formatting for bash commands
  const formatBashOutput = (content) => {
    // First, unescape HTML entities if present
    let unescapedContent = content;
    if (content.includes('&lt;') || content.includes('&gt;')) {
      unescapedContent = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    
    // Check if this is a bash command output
    if (unescapedContent.includes('<bash-input>') || unescapedContent.includes('<bash-stdout>') || unescapedContent.includes('<bash-stderr>')) {
      // Parse bash tags with multi-line support
      const elements = [];
      let currentPos = 0;
      let elementKey = 0;
      
      // Process bash-input tags
      const inputRegex = /<bash-input>([\s\S]*?)<\/bash-input>/g;
      const stdoutRegex = /<bash-stdout>([\s\S]*?)<\/bash-stdout>/g;
      const stderrRegex = /<bash-stderr>([\s\S]*?)<\/bash-stderr>/g;
      
      // Collect all matches with their positions
      const matches = [];
      let match;
      
      // Reset regex lastIndex to ensure proper matching
      inputRegex.lastIndex = 0;
      stdoutRegex.lastIndex = 0;
      stderrRegex.lastIndex = 0;
      
      while ((match = inputRegex.exec(unescapedContent)) !== null) {
        matches.push({
          type: 'input',
          content: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      while ((match = stdoutRegex.exec(unescapedContent)) !== null) {
        matches.push({
          type: 'stdout',
          content: match[1],
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      while ((match = stderrRegex.exec(unescapedContent)) !== null) {
        matches.push({
          type: 'stderr',
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
          const text = unescapedContent.substring(currentPos, match.start).trim();
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
        } else if (match.type === 'stderr') {
          // Show stderr even if empty
          elements.push(
            <div key={`err-${elementKey++}`} className="font-mono text-sm text-red-400 ml-6 whitespace-pre-wrap">
              {match.content || ''}
            </div>
          );
        }
        
        currentPos = match.end;
      }
      
      // Add any remaining text
      if (currentPos < unescapedContent.length) {
        const text = unescapedContent.substring(currentPos).trim();
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
  
  if (message.type === 'user') {
    // Check if this is a bash command/output that needs formatting
    const content = message.content || '';
    const hasBashTags = content.includes('<bash-input>') || content.includes('<bash-stdout>') || content.includes('<bash-stderr>') ||
                       content.includes('&lt;bash-input&gt;') || content.includes('&lt;bash-stdout&gt;') || content.includes('&lt;bash-stderr&gt;');
    
    if (hasBashTags) {
      return (
        <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
          <div className="bg-gray-800 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
            {formatBashOutput(content)}
            <div className="text-xs text-gray-400 mt-1 text-right">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
            U
          </div>
        </div>
      );
    }
    
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

  // Render assistant message content
  const renderContent = () => {
    const content = message.content || '';
    
    // Check if this content contains bash tags that need special formatting
    if (content.includes('<bash-input>') || content.includes('<bash-stdout>') || content.includes('<bash-stderr>') ||
        content.includes('&lt;bash-input&gt;') || content.includes('&lt;bash-stdout&gt;') || content.includes('&lt;bash-stderr&gt;')) {
      // This is terminal content, use formatBashOutput which returns JSX
      return formatBashOutput(content);
    }
    
    // Regular content goes through ReactMarkdown
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
        {content}
      </ReactMarkdown>
    );
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