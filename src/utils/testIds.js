/**
 * Test IDs for E2E testing
 * Using kebab-case hierarchical naming convention
 * These IDs should only be used for testing, not for styling
 */

export const TEST_IDS = {
  // Authentication
  auth: {
    loginForm: 'auth-login-form',
    usernameInput: 'auth-username-input',
    passwordInput: 'auth-password-input',
    signInButton: 'auth-sign-in-button',
    signOutButton: 'auth-sign-out-button',
    errorMessage: 'auth-error-message',
    setupForm: 'auth-setup-form',
    serverUrlInput: 'auth-server-url-input',
    apiTokenInput: 'auth-api-token-input'
  },

  // Navigation
  nav: {
    sidebar: 'nav-sidebar',
    mainNav: 'nav-main',
    mobileMenuButton: 'nav-mobile-menu-button',
    machineSelector: 'nav-machine-selector',
    projectList: 'nav-project-list',
    projectItem: 'project-item',
    tabChat: 'nav-tab-chat',
    tabGit: 'nav-tab-git',
    tabFiles: 'nav-tab-files',
    tabTerminal: 'nav-tab-terminal',
    tabTodo: 'nav-tab-todo',
    settingsButton: 'nav-settings-button'
  },

  // Machine Selector
  machine: {
    selector: 'machine-selector',
    option: 'machine-option',
    statusIndicator: 'machine-status-indicator',
    addButton: 'machine-add-button'
  },

  // Projects
  project: {
    list: 'project-list',
    item: 'project-item',
    addButton: 'project-add-button',
    createDialog: 'project-create-dialog',
    pathInput: 'project-path-input',
    createButton: 'project-create-button',
    deleteButton: 'project-delete-button',
    selectButton: 'project-select-button'
  },

  // Chat Interface
  chat: {
    container: 'chat-container',
    messageList: 'chat-message-list',
    message: 'chat-message',
    input: 'chat-input',
    sendButton: 'chat-send-button',
    stopButton: 'chat-stop-button',
    clearButton: 'chat-clear-button',
    imageUpload: 'chat-image-upload',
    micButton: 'chat-mic-button'
  },

  // Git Panel
  git: {
    container: 'git-container',
    statusList: 'git-status-list',
    commitButton: 'git-commit-button',
    pushButton: 'git-push-button',
    pullButton: 'git-pull-button',
    branchSelector: 'git-branch-selector',
    fileItem: 'git-file-item'
  },

  // File Explorer
  files: {
    container: 'files-container',
    tree: 'files-tree',
    treeItem: 'files-tree-item',
    openButton: 'files-open-button',
    newFileButton: 'files-new-file-button',
    newFolderButton: 'files-new-folder-button'
  },

  // Terminal
  terminal: {
    container: 'terminal-container',
    input: 'terminal-input',
    output: 'terminal-output',
    clearButton: 'terminal-clear-button'
  },

  // Settings
  settings: {
    dialog: 'settings-dialog',
    tabApi: 'settings-tab-api',
    tabTools: 'settings-tab-tools',
    tabHooks: 'settings-tab-hooks',
    tabAuth: 'settings-tab-auth',
    saveButton: 'settings-save-button',
    cancelButton: 'settings-cancel-button',
    apiKeyInput: 'settings-api-key-input',
    modelSelect: 'settings-model-select'
  },

  // Common UI Elements
  ui: {
    loading: 'ui-loading',
    error: 'ui-error',
    success: 'ui-success',
    modal: 'ui-modal',
    modalClose: 'ui-modal-close',
    dropdown: 'ui-dropdown',
    dropdownItem: 'ui-dropdown-item'
  }
};

/**
 * Helper function to generate test ID with index for dynamic lists
 * @param {string} baseId - Base test ID
 * @param {number} index - Index in the list
 * @returns {string} Test ID with index
 */
export function getIndexedTestId(baseId, index) {
  return `${baseId}-${index}`;
}

/**
 * Helper function to generate test ID with custom suffix
 * @param {string} baseId - Base test ID
 * @param {string} suffix - Custom suffix
 * @returns {string} Test ID with suffix
 */
export function getTestIdWithSuffix(baseId, suffix) {
  return `${baseId}-${suffix}`;
}