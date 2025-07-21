import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageAttachment from './ImageAttachment';
import { MicButton } from '../MicButton';
import { TEST_IDS } from '../../utils/testIds';

const MessageInput = ({ 
  onSubmit, 
  isLoading, 
  permissionMode,
  onPermissionModeChange,
  attachedImages,
  onImagesChange,
  uploadingImages,
  imageErrors,
  onFileReference,
  projectFiles = [],
  onInputFocusChange
}) => {
  const [input, setInput] = useState('');
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const textareaRef = useRef(null);
  const fileDropdownRef = useRef(null);

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: true,
    onDrop: (acceptedFiles) => {
      onImagesChange([...attachedImages, ...acceptedFiles]);
    },
    noClick: true,
    noKeyboard: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    onSubmit(input, attachedImages);
    setInput('');
    onImagesChange([]);
    setIsTextareaExpanded(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const modes = ['default', 'plan', 'code', 'architect'];
      const currentIndex = modes.indexOf(permissionMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      onPermissionModeChange(modes[nextIndex]);
    } else if (e.key === '@') {
      e.preventDefault();
      setShowFileDropdown(true);
      setFileSearchQuery('');
      setSelectedFileIndex(0);
    } else if (showFileDropdown) {
      if (e.key === 'Escape') {
        setShowFileDropdown(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedFileIndex(Math.min(selectedFileIndex + 1, filteredFiles.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedFileIndex(Math.max(selectedFileIndex - 1, 0));
      } else if (e.key === 'Enter' && showFileDropdown) {
        e.preventDefault();
        const file = filteredFiles[selectedFileIndex];
        if (file) {
          insertFileReference(file);
        }
      }
    }
  };

  const insertFileReference = (file) => {
    const reference = `@${file}`;
    setInput(input + reference + ' ');
    setShowFileDropdown(false);
    textareaRef.current?.focus();
    onFileReference?.(file);
  };

  const filteredFiles = projectFiles.filter(file => 
    file.toLowerCase().includes(fileSearchQuery.toLowerCase())
  ).slice(0, 10);

  const handleTranscript = (transcript) => {
    setInput(prev => prev + (prev ? ' ' : '') + transcript);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(event.target)) {
        setShowFileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="border-t dark:border-gray-700 bg-white dark:bg-gray-800">
      <div {...getRootProps()} className="px-4 py-4">
        <input {...getInputProps()} />
        
        {/* Permission mode selector */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Mode:</span>
            <div className="flex space-x-1">
              {['default', 'plan', 'code', 'architect'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => onPermissionModeChange(mode)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    permissionMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Attached images */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachedImages.map((file, index) => (
              <ImageAttachment
                key={index}
                file={file}
                onRemove={() => {
                  const newImages = attachedImages.filter((_, i) => i !== index);
                  onImagesChange(newImages);
                }}
                uploadProgress={uploadingImages.get(index)}
                error={imageErrors.get(index)}
              />
            ))}
          </div>
        )}

        {/* Input form */}
        <form onSubmit={handleSubmit} className="relative" autoComplete="off">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsTextareaExpanded(true);
                onInputFocusChange?.(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsTextareaExpanded(false);
                  onInputFocusChange?.(false);
                }, 200);
              }}
              placeholder="Type a message..."
              rows={isTextareaExpanded ? 4 : 1}
              className="w-full pl-12 pr-32 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:rounded-2xl transition-all duration-200 ease-in-out resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              disabled={isLoading}
              data-testid={TEST_IDS.chat.messageInput}
            />

            {/* File dropdown */}
            {showFileDropdown && (
              <div 
                ref={fileDropdownRef}
                className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto"
              >
                <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={fileSearchQuery}
                    onChange={(e) => {
                      setFileSearchQuery(e.target.value);
                      setSelectedFileIndex(0);
                    }}
                    placeholder="Search files..."
                    className="w-full px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm focus:outline-none"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <div className="py-1">
                  {filteredFiles.map((file, index) => (
                    <button
                      key={file}
                      onClick={() => insertFileReference(file)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        index === selectedFileIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      {file}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Clear button */}
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setIsTextareaExpanded(false);
                }}
                className="absolute -left-0.5 -top-3 sm:right-28 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center transition-all duration-200 group z-10 shadow-sm"
                title="Clear input"
                data-testid={TEST_IDS.chat.clearButton}
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Image upload button */}
            <button
              type="button"
              onClick={open}
              className="absolute left-2 bottom-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Attach images"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            
            {/* Mic button - HIDDEN */}
            <div className="absolute right-16 sm:right-16 top-1/2 transform -translate-y-1/2" style={{ display: 'none' }}>
              <MicButton onTranscript={handleTranscript} className="w-10 h-10 sm:w-10 sm:h-10" />
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSubmit(e);
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:ring-offset-gray-800"
              data-testid={TEST_IDS.chat.sendButton}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          {/* Hint text */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 hidden sm:block">
            Press Enter to send • Shift+Enter for new line • Tab to change modes • @ to reference files
          </div>
        </form>
      </div>
    </div>
  );
};

export default MessageInput;