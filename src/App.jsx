/*
 * App.jsx - Main Application Component with Session Protection System
 * 
 * SESSION PROTECTION SYSTEM OVERVIEW:
 * ===================================
 * 
 * Problem: Automatic project updates from WebSocket would refresh the sidebar and clear chat messages
 * during active conversations, creating a poor user experience.
 * 
 * Solution: Track "active sessions" and pause project updates during conversations.
 * 
 * How it works:
 * 1. When user sends message → session marked as "active" 
 * 2. Project updates are skipped while session is active
 * 3. When conversation completes/aborts → session marked as "inactive"
 * 4. Project updates resume normally
 * 
 * Handles both existing sessions (with real IDs) and new sessions (with temporary IDs).
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MobileNav from './components/MobileNav';
import ToolsSettings from './components/ToolsSettings';
import QuickSettingsPanel from './components/QuickSettingsPanel';
import MachineSelector from './components/MachineSelector';

import { useWebSocket } from './utils/websocket';
import { useMachines } from './hooks/useMachines';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useVersionCheck } from './hooks/useVersionCheck';
import { api } from './utils/api';
import { useAuth } from './contexts/AuthContext';

// Logout component that handles logout and redirects
function LogoutRoute() {
  const { logout } = useAuth();
  
  React.useEffect(() => {
    logout();
    // Force page reload to clear all state and redirect to login
    window.location.href = '/';
  }, [logout]);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">Logging out...</h2>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}

// Main App component with routing
function AppContent() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  
  const { updateAvailable, latestVersion, currentVersion } = useVersionCheck('iotashan', 'ccmcc');
  const [showVersionModal, setShowVersionModal] = useState(false);
  
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'files'
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showToolsSettings, setShowToolsSettings] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [autoExpandTools, setAutoExpandTools] = useState(() => {
    const saved = localStorage.getItem('autoExpandTools');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showRawParameters, setShowRawParameters] = useState(() => {
    const saved = localStorage.getItem('showRawParameters');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [autoScrollToBottom, setAutoScrollToBottom] = useState(() => {
    const saved = localStorage.getItem('autoScrollToBottom');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [sendByCtrlEnter, setSendByCtrlEnter] = useState(() => {
    const saved = localStorage.getItem('sendByCtrlEnter');
    return saved !== null ? JSON.parse(saved) : false;
  });
  // Session Protection System: Track sessions with active conversations to prevent
  // automatic project updates from interrupting ongoing chats. When a user sends
  // a message, the session is marked as "active" and project updates are paused
  // until the conversation completes or is aborted.
  const [activeSessions, setActiveSessions] = useState(new Set()); // Track sessions with active conversations
  
  // Claude session tracking
  const [waitingSessions, setWaitingSessions] = useState({}); // Track waiting sessions per machine
  
  const { ws, sendMessage, messages } = useWebSocket();
  
  // Machine management
  const { 
    machines, 
    selectedMachine, 
    selectMachine, 
    removeMachine, 
    isSelectedMachineOnline 
  } = useMachines(messages);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Fetch projects on component mount
    fetchProjects();
  }, []);

  // Refresh projects when selected machine changes
  useEffect(() => {
    if (selectedMachine !== undefined) {
      console.log('Machine changed to:', selectedMachine);
      // Set loading state and clear projects immediately
      setIsLoadingProjects(true);
      setProjects([]);
      setSelectedProject(null);
      setSelectedSession(null);
      // Then fetch new projects
      fetchProjects();
    }
  }, [selectedMachine]);

  // Helper function to determine if an update is purely additive (new sessions/projects)
  // vs modifying existing selected items that would interfere with active conversations
  const isUpdateAdditive = (currentProjects, updatedProjects, selectedProject, selectedSession) => {
    if (!selectedProject || !selectedSession) {
      // No active session to protect, allow all updates
      return true;
    }

    // Find the selected project in both current and updated data
    const currentSelectedProject = currentProjects?.find(p => p.name === selectedProject.name);
    const updatedSelectedProject = updatedProjects?.find(p => p.name === selectedProject.name);

    if (!currentSelectedProject || !updatedSelectedProject) {
      // Project structure changed significantly, not purely additive
      return false;
    }

    // Find the selected session in both current and updated project data
    const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === selectedSession.id);
    const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id);

    if (!currentSelectedSession || !updatedSelectedSession) {
      // Selected session was deleted or significantly changed, not purely additive
      return false;
    }

    // Check if the selected session's content has changed (modification vs addition)
    // Compare key fields that would affect the loaded chat interface
    const sessionUnchanged = 
      currentSelectedSession.id === updatedSelectedSession.id &&
      currentSelectedSession.title === updatedSelectedSession.title &&
      currentSelectedSession.createdAt === updatedSelectedSession.createdAt &&
      currentSelectedSession.updatedAt === updatedSelectedSession.updatedAt;

    // This is considered additive if the selected session is unchanged
    // (new sessions may have been added elsewhere, but active session is protected)
    return sessionUnchanged;
  };

  // Handle WebSocket messages for real-time project updates
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      if (latestMessage.type === 'projects_updated') {
        // Skip project updates from server when a remote machine is selected
        // These updates are for the server's local projects only
        if (selectedMachine && selectedMachine !== 'local') {
          console.log('Ignoring server project update - remote machine selected:', selectedMachine);
          return;
        }
        
        // Session Protection Logic: Allow additions but prevent changes during active conversations
        // This allows new sessions/projects to appear in sidebar while protecting active chat messages
        // We check for two types of active sessions:
        // 1. Existing sessions: selectedSession.id exists in activeSessions
        // 2. New sessions: temporary "new-session-*" identifiers in activeSessions (before real session ID is received)
        const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                                 (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));
        
        if (hasActiveSession) {
          // Allow updates but be selective: permit additions, prevent changes to existing items
          const updatedProjects = latestMessage.projects;
          const currentProjects = projects;
          
          // Check if this is purely additive (new sessions/projects) vs modification of existing ones
          const isAdditiveUpdate = isUpdateAdditive(currentProjects, updatedProjects, selectedProject, selectedSession);
          
          if (!isAdditiveUpdate) {
            // Skip updates that would modify existing selected session/project
            return;
          }
          // Continue with additive updates below
        }
        
        // Update projects state with the new data from WebSocket
        const updatedProjects = latestMessage.projects;
        setProjects(updatedProjects);
        
        // Update selected project if it exists in the updated projects
        if (selectedProject) {
          const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
          if (updatedSelectedProject) {
            setSelectedProject(updatedSelectedProject);
            
            // Update selected session only if it was deleted - avoid unnecessary reloads
            if (selectedSession) {
              const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id);
              if (!updatedSelectedSession) {
                // Session was deleted
                setSelectedSession(null);
              }
              // Don't update if session still exists with same ID - prevents reload
            }
          }
        }
      } else if (latestMessage.type === 'claude_session_update') {
        // Handle Claude session updates from hooks
        console.log('Received Claude session update:', latestMessage);
        setWaitingSessions(latestMessage.waitingSessions || {});
      }
    }
  }, [messages, selectedProject, selectedSession, activeSessions]);

  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await api.projects();
      const data = await response.json();
      
      // Debug logging to see what's returned from remote machines
      console.log('Projects API response:', data);
      
      // Ensure data is an array
      const projectsData = Array.isArray(data) ? data : [];
      
      // Optimize to preserve object references when data hasn't changed
      setProjects(prevProjects => {
        // If no previous projects, just set the new data
        if (prevProjects.length === 0) {
          return projectsData;
        }
        
        // Check if the projects data has actually changed
        const hasChanges = projectsData.some((newProject, index) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;
          
          // Compare key properties that would affect UI
          return (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath ||
            JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
            JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions)
          );
        }) || projectsData.length !== prevProjects.length;
        
        // Only update if there are actual changes
        return hasChanges ? projectsData : prevProjects;
      });
      
      // Don't auto-select any project - user should choose manually
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Expose fetchProjects globally for component access
  window.refreshProjects = fetchProjects;

  // Handle URL-based session loading
  useEffect(() => {
    if (sessionId && projects.length > 0 && (!selectedSession || selectedSession.id !== sessionId)) {
      // Find the session across all projects
      for (const project of projects) {
        const session = project.sessions?.find(s => s.id === sessionId);
        if (session) {
          setSelectedProject(project);
          setSelectedSession(session);
          setActiveTab('chat');
          return;
        }
      }
      
      // If session not found, it might be a newly created session
      // Just navigate to it and it will be found when the sidebar refreshes
      // Don't redirect to home, let the session load naturally
    }
  }, [sessionId, projects]); // Remove navigate to avoid warnings, remove selectedSession to avoid loops

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    // Only switch to chat tab when user explicitly selects a session
    // This prevents tab switching during automatic updates
    if (activeTab !== 'git' && activeTab !== 'preview') {
      setActiveTab('chat');
    }
    if (isMobile) {
      setSidebarOpen(false);
    }
    navigate(`/session/${session.id}`);
  };

  const handleNewSession = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveTab('chat');
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionDelete = (sessionId) => {
    // If the deleted session was currently selected, clear it
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
      navigate('/');
    }
    
    // Update projects state locally instead of full refresh
    setProjects(prevProjects => 
      prevProjects.map(project => ({
        ...project,
        sessions: project.sessions?.filter(session => session.id !== sessionId) || [],
        sessionMeta: {
          ...project.sessionMeta,
          total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
        }
      }))
    );
  };



  const handleSidebarRefresh = async () => {
    // Refresh only the sessions for all projects, don't change selected state
    try {
      const response = await api.projects();
      const freshProjects = await response.json();
      
      // Optimize to preserve object references and minimize re-renders
      setProjects(prevProjects => {
        // Check if projects data has actually changed
        const hasChanges = freshProjects.some((newProject, index) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;
          
          return (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath ||
            JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
            JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions)
          );
        }) || freshProjects.length !== prevProjects.length;
        
        return hasChanges ? freshProjects : prevProjects;
      });
      
      // If we have a selected project, make sure it's still selected after refresh
      if (selectedProject) {
        const refreshedProject = freshProjects.find(p => p.name === selectedProject.name);
        if (refreshedProject) {
          // Only update selected project if it actually changed
          if (JSON.stringify(refreshedProject) !== JSON.stringify(selectedProject)) {
            setSelectedProject(refreshedProject);
          }
          
          // If we have a selected session, try to find it in the refreshed project
          if (selectedSession) {
            const refreshedSession = refreshedProject.sessions?.find(s => s.id === selectedSession.id);
            if (refreshedSession && JSON.stringify(refreshedSession) !== JSON.stringify(selectedSession)) {
              setSelectedSession(refreshedSession);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing sidebar:', error);
    }
  };

  const handleProjectDelete = (projectName) => {
    // If the deleted project was currently selected, clear it
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      navigate('/');
    }
    
    // Update projects state locally instead of full refresh
    setProjects(prevProjects => 
      prevProjects.filter(project => project.name !== projectName)
    );
  };

  const handleUpdateSessionSummary = async (projectName, sessionId, newSummary) => {
    try {
      const response = await api.updateSessionSummary(projectName, sessionId, newSummary);
      
      if (response.ok) {
        // Update local state to reflect the change
        setProjects(prevProjects => 
          prevProjects.map(project => {
            if (project.name === projectName) {
              return {
                ...project,
                sessions: project.sessions?.map(session => 
                  session.id === sessionId 
                    ? { ...session, summary: newSummary }
                    : session
                ) || []
              };
            }
            return project;
          })
        );
        
        // Update selected session if it's the one being edited
        if (selectedSession?.id === sessionId) {
          setSelectedSession(prev => ({ ...prev, summary: newSummary }));
        }
        
        // Trigger project refresh to sync with server
        if (window.refreshProjects) {
          window.refreshProjects();
        }
      }
    } catch (error) {
      console.error('Error updating session summary:', error);
    }
  };

  // Session Protection Functions: Manage the lifecycle of active sessions
  
  // markSessionAsActive: Called when user sends a message to mark session as protected
  // This includes both real session IDs and temporary "new-session-*" identifiers
  const markSessionAsActive = (sessionId) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
    }
  };

  // markSessionAsInactive: Called when conversation completes/aborts to re-enable project updates
  const markSessionAsInactive = (sessionId) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  // replaceTemporarySession: Called when WebSocket provides real session ID for new sessions
  // Removes temporary "new-session-*" identifiers and adds the real session ID
  // This maintains protection continuity during the transition from temporary to real session
  const replaceTemporarySession = (realSessionId) => {
    if (realSessionId) {
      setActiveSessions(prev => {
        const newSet = new Set();
        // Keep all non-temporary sessions and add the real session ID
        for (const sessionId of prev) {
          if (!sessionId.startsWith('new-session-')) {
            newSet.add(sessionId);
          }
        }
        newSet.add(realSessionId);
        return newSet;
      });
    }
  };

  // Version Upgrade Modal Component
  const VersionUpgradeModal = () => {
    if (!showVersionModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowVersionModal(false)}
        />
        
        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Available</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">A new version is ready</p>
              </div>
            </div>
            <button
              onClick={() => setShowVersionModal(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Version Info */}
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Version</span>
              <span className="text-sm text-gray-900 dark:text-white font-mono">{currentVersion}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Latest Version</span>
              <span className="text-sm text-blue-900 dark:text-blue-100 font-mono">{latestVersion}</span>
            </div>
          </div>

          {/* Upgrade Instructions */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">How to upgrade:</h3>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border">
              <code className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                git checkout main && git pull && npm install
              </code>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Run this command in your CCMCC directory to update to the latest version.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowVersionModal(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Later
            </button>
            <button
              onClick={() => {
                // Copy command to clipboard
                navigator.clipboard.writeText('git checkout main && git pull && npm install');
                setShowVersionModal(false);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Copy Command
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Fixed Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 flex-shrink-0 border-r border-border bg-card">
          <div className="h-full overflow-hidden">
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowToolsSettings(true)}
              updateAvailable={updateAvailable}
              latestVersion={latestVersion}
              currentVersion={currentVersion}
              onShowVersionModal={() => setShowVersionModal(true)}
              machines={machines}
              selectedMachine={selectedMachine}
              onMachineSelect={selectMachine}
              onMachineRemove={removeMachine}
              waitingSessions={waitingSessions}
            />
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${
          sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-150 ease-out"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
          />
          <div 
            className={`relative w-[85vw] max-w-sm sm:w-80 bg-card border-r border-border h-full transform transition-transform duration-150 ease-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowToolsSettings(true)}
              updateAvailable={updateAvailable}
              latestVersion={latestVersion}
              currentVersion={currentVersion}
              onShowVersionModal={() => setShowVersionModal(true)}
              machines={machines}
              selectedMachine={selectedMachine}
              onMachineSelect={selectMachine}
              onMachineRemove={removeMachine}
              waitingSessions={waitingSessions}
            />
          </div>
        </div>
      )}

      {/* Main Content Area - Flexible */}
      <div className="flex-1 flex flex-col min-w-0">
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ws={ws}
          sendMessage={sendMessage}
          messages={messages}
          isMobile={isMobile}
          onMenuClick={() => setSidebarOpen(true)}
          isLoading={isLoadingProjects}
          onInputFocusChange={setIsInputFocused}
          onSessionActive={markSessionAsActive}
          onSessionInactive={markSessionAsInactive}
          onReplaceTemporarySession={replaceTemporarySession}
          onNavigateToSession={(sessionId) => navigate(`/session/${sessionId}`)}
          onShowSettings={() => setShowToolsSettings(true)}
          onUpdateSessionSummary={handleUpdateSessionSummary}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          autoScrollToBottom={autoScrollToBottom}
          selectedMachine={selectedMachine}
          sendByCtrlEnter={sendByCtrlEnter}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInputFocused={isInputFocused}
        />
      )}
      {/* Quick Settings Panel - Only show on chat tab */}
      {activeTab === 'chat' && (
        <QuickSettingsPanel
          isOpen={showQuickSettings}
          onToggle={setShowQuickSettings}
          autoExpandTools={autoExpandTools}
          onAutoExpandChange={(value) => {
            setAutoExpandTools(value);
            localStorage.setItem('autoExpandTools', JSON.stringify(value));
          }}
          showRawParameters={showRawParameters}
          onShowRawParametersChange={(value) => {
            setShowRawParameters(value);
            localStorage.setItem('showRawParameters', JSON.stringify(value));
          }}
          autoScrollToBottom={autoScrollToBottom}
          onAutoScrollChange={(value) => {
            setAutoScrollToBottom(value);
            localStorage.setItem('autoScrollToBottom', JSON.stringify(value));
          }}
          sendByCtrlEnter={sendByCtrlEnter}
          onSendByCtrlEnterChange={(value) => {
            setSendByCtrlEnter(value);
            localStorage.setItem('sendByCtrlEnter', JSON.stringify(value));
          }}
          isMobile={isMobile}
        />
      )}

      {/* Tools Settings Modal */}
      <ToolsSettings
        isOpen={showToolsSettings}
        onClose={() => setShowToolsSettings(false)}
        selectedMachine={selectedMachine}
        machines={machines}
      />

      {/* Version Upgrade Modal */}
      <VersionUpgradeModal />
    </div>
  );
}

// Root App component with router
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/logout" element={<LogoutRoute />} />
            <Route path="/" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
            <Route path="/session/:sessionId" element={<ProtectedRoute><AppContent /></ProtectedRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;