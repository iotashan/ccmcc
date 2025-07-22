import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const ToolUseMessage = ({ message, autoExpandTools, showRawParameters }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const messageRef = React.useRef(null);

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            const details = messageRef.current.querySelectorAll('details');
            details.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    
    observer.observe(messageRef.current);
    
    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [autoExpandTools, isExpanded]);

  const renderToolResult = (result) => {
    if (!result) return 'No result';
    
    if (typeof result === 'string') {
      // Check for bash output formatting
      if (result.includes('<bash-input>') || result.includes('<bash-stdout>') || result.includes('<bash-stderr>')) {
        return formatBashTerminalOutput(result);
      }
      
      // For other string results, render as markdown
      return (
        <ReactMarkdown
          components={{
            pre: ({ children }) => (
              <pre className="bg-gray-50 dark:bg-gray-900 rounded p-3 overflow-x-auto text-xs whitespace-pre-wrap">
                {children}
              </pre>
            ),
            code: ({ inline, children }) => 
              inline ? (
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">
                  {children}
                </code>
              ) : (
                <div>{children}</div>
              )
          }}
        >
          {result}
        </ReactMarkdown>
      );
    }
    
    return (
      <pre className="bg-gray-50 dark:bg-gray-900 rounded p-3 overflow-x-auto text-xs whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  const formatBashTerminalOutput = (content) => {
    // Handle multi-line bash output with proper regex
    const elements = [];
    let currentPos = 0;
    let elementKey = 0;
    
    // Process bash-input tags (can be multi-line)
    const inputRegex = /<bash-input>([\s\S]*?)<\/bash-input>/g;
    const stdoutRegex = /<bash-stdout>([\s\S]*?)<\/bash-stdout>/g;
    const stderrRegex = /<bash-stderr>([\s\S]*?)<\/bash-stderr>/g;
    
    // Collect all matches with their positions
    const matches = [];
    let match;
    
    while ((match = inputRegex.exec(content)) !== null) {
      matches.push({
        type: 'input',
        content: match[1],
        index: match.index,
        fullMatch: match[0]
      });
    }
    
    while ((match = stdoutRegex.exec(content)) !== null) {
      matches.push({
        type: 'stdout',
        content: match[1],
        index: match.index,
        fullMatch: match[0]
      });
    }
    
    while ((match = stderrRegex.exec(content)) !== null) {
      matches.push({
        type: 'stderr',
        content: match[1],
        index: match.index,
        fullMatch: match[0]
      });
    }
    
    // Sort by position
    matches.sort((a, b) => a.index - b.index);
    
    // Process matches
    for (const match of matches) {
      // Add any text before this match as plain text
      if (match.index > currentPos) {
        const plainText = content.substring(currentPos, match.index).trim();
        if (plainText) {
          elements.push(
            <div key={`plain-${elementKey++}`} className="font-mono text-gray-400">
              {plainText}
            </div>
          );
        }
      }
      
      if (match.type === 'input') {
        elements.push(
          <div key={`cmd-${elementKey++}`} className="flex items-start space-x-2 font-mono">
            <span className="text-green-500 select-none">$</span>
            <span className="text-gray-100 whitespace-pre-wrap">{match.content}</span>
          </div>
        );
      } else if (match.type === 'stdout' && match.content.trim()) {
        elements.push(
          <div key={`out-${elementKey++}`} className="font-mono text-gray-300 ml-6 whitespace-pre-wrap">
            {match.content}
          </div>
        );
      } else if (match.type === 'stderr') {
        // Show stderr even if empty, with red color
        elements.push(
          <div key={`err-${elementKey++}`} className="font-mono text-red-400 ml-6 whitespace-pre-wrap">
            {match.content || ''}
          </div>
        );
      }
      
      currentPos = match.index + match.fullMatch.length;
    }
    
    // Add any remaining text
    if (currentPos < content.length) {
      const remainingText = content.substring(currentPos).trim();
      if (remainingText) {
        elements.push(
          <div key={`plain-${elementKey++}`} className="font-mono text-gray-400">
            {remainingText}
          </div>
        );
      }
    }
    
    return (
      <div className="bg-gray-900 rounded p-3 overflow-x-auto text-sm">
        {elements.length > 0 ? elements : (
          <div className="font-mono text-gray-400">{content}</div>
        )}
      </div>
    );
  };

  const getToolIcon = (toolName) => {
    const icons = {
      Bash: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      Read: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      Write: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      Edit: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      default: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    };
    
    return icons[toolName] || icons.default;
  };

  return (
    <div ref={messageRef} className="tool-use-message bg-gray-50 dark:bg-gray-800 rounded-lg p-4 my-2 border border-gray-200 dark:border-gray-700">
      <details open={autoExpandTools}>
        <summary className="cursor-pointer flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {getToolIcon(message.toolName)}
          <span>{message.toolName}</span>
          {message.status && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              message.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              message.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {message.status}
            </span>
          )}
        </summary>
        
        <div className="mt-3 space-y-3">
          {showRawParameters && message.parameters && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded p-3">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Parameters:</div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(message.parameters, null, 2)}
              </pre>
            </div>
          )}
          
          {message.result && (
            <div className="bg-white dark:bg-gray-900 rounded p-3">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Result:</div>
              {renderToolResult(message.result)}
            </div>
          )}
        </div>
      </details>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ToolUseMessage;