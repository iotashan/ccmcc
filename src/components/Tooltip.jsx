import React, { useState } from 'react';

function Tooltip({ children, content, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      top: rect.top - 30,
      left: rect.left + rect.width / 2
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && content && (
        <div
          className={`fixed z-50 px-2 py-1 text-xs bg-gray-900 dark:bg-gray-700 text-white rounded shadow-lg whitespace-nowrap ${className}`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {content}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px"
            style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid rgb(17 24 39)',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default Tooltip;