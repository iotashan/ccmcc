// tests/e2e/pages/chat.page.js
export class ChatPage {
  constructor(page) {
    this.page = page;
    
    // Chat interface
    this.chatContainer = page.locator('[data-testid="chat-container"]');
    this.chatInput = page.locator('[data-testid="chat-input"]');
    this.sendButton = page.locator('[data-testid="send-button"]');
    this.messageList = page.locator('[data-testid="message-list"]');
    this.typingIndicator = page.locator('[data-testid="assistant-typing"]');
    
    // File attachments
    this.attachButton = page.locator('[data-testid="attach-button"]');
    this.fileInput = page.locator('[data-testid="file-input"]');
    this.attachedFiles = page.locator('[data-testid="attached-files"]');
    
    // Code blocks
    this.codeBlocks = page.locator('[data-testid="code-block"]');
    this.copyCodeButton = page.locator('[data-testid="copy-code"]');
    this.runCodeButton = page.locator('[data-testid="run-code"]');
    
    // Session controls
    this.clearChatButton = page.locator('[data-testid="clear-chat"]');
    this.exportChatButton = page.locator('[data-testid="export-chat"]');
    this.sessionName = page.locator('[data-testid="session-name"]');
    this.renameSessionButton = page.locator('[data-testid="rename-session"]');
    
    // Tool usage indicators
    this.toolUseIndicator = page.locator('[data-testid="tool-use"]');
    this.fileChangesIndicator = page.locator('[data-testid="file-changes"]');
    
    // Error states
    this.errorMessage = page.locator('[data-testid="chat-error"]');
    this.retryButton = page.locator('[data-testid="retry-message"]');
    
    // Command palette
    this.commandPaletteButton = page.locator('[data-testid="command-palette-button"]');
    this.commandPalette = page.locator('[data-testid="command-palette"]');
  }

  async goto(sessionId) {
    await this.page.goto(`/session/${sessionId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async sendMessage(message, waitForResponse = true) {
    await this.chatInput.fill(message);
    await this.sendButton.click();
    
    if (waitForResponse) {
      await this.waitForAssistantResponse();
    }
  }

  async sendMessageWithEnter(message, waitForResponse = true) {
    await this.chatInput.fill(message);
    await this.page.keyboard.press('Enter');
    
    if (waitForResponse) {
      await this.waitForAssistantResponse();
    }
  }

  async waitForAssistantResponse(timeout = 30000) {
    // Wait for typing indicator to appear and disappear
    await this.typingIndicator.waitFor({ state: 'visible', timeout: 5000 });
    await this.typingIndicator.waitFor({ state: 'hidden', timeout });
  }

  async getLastMessage() {
    const messages = await this.messageList.locator('.message').all();
    if (messages.length === 0) return null;
    
    const lastMessage = messages[messages.length - 1];
    const role = await lastMessage.getAttribute('data-role');
    const content = await lastMessage.locator('.message-content').textContent();
    
    return { role, content };
  }

  async getMessageCount() {
    const messages = await this.messageList.locator('.message').all();
    return messages.length;
  }

  async getMessageByIndex(index) {
    const message = this.messageList.locator('.message').nth(index);
    const role = await message.getAttribute('data-role');
    const content = await message.locator('.message-content').textContent();
    
    return { role, content };
  }

  async attachFile(filePath) {
    await this.attachButton.click();
    await this.fileInput.setInputFiles(filePath);
    await this.page.waitForSelector('[data-testid="attached-file-item"]');
  }

  async removeAttachedFile(fileName) {
    const removeButton = this.page.locator(`[data-testid="remove-${fileName}"]`);
    await removeButton.click();
  }

  async copyCodeBlock(index = 0) {
    const codeBlock = this.codeBlocks.nth(index);
    await codeBlock.hover();
    const copyButton = codeBlock.locator('[data-testid="copy-code"]');
    await copyButton.click();
    
    // Check for success toast
    await this.page.waitForSelector('[data-testid="copy-success"]');
  }

  async runCodeBlock(index = 0) {
    const codeBlock = this.codeBlocks.nth(index);
    await codeBlock.hover();
    const runButton = codeBlock.locator('[data-testid="run-code"]');
    await runButton.click();
    
    // Wait for execution result
    await this.page.waitForSelector('[data-testid="code-output"]');
  }

  async clearChat() {
    await this.clearChatButton.click();
    await this.page.click('[data-testid="confirm-clear"]');
    await this.page.waitForSelector('[data-testid="chat-cleared"]');
  }

  async exportChat(format = 'markdown') {
    await this.exportChatButton.click();
    await this.page.click(`[data-testid="export-${format}"]`);
    
    // Wait for download
    const download = await this.page.waitForEvent('download');
    return download;
  }

  async renameSession(newName) {
    await this.renameSessionButton.click();
    await this.page.fill('[data-testid="session-name-input"]', newName);
    await this.page.keyboard.press('Enter');
    await this.page.waitForSelector(`[data-testid="session-name"]:has-text("${newName}")`);
  }

  async getToolUsageCount() {
    const toolUses = await this.toolUseIndicator.all();
    return toolUses.length;
  }

  async getFileChanges() {
    const changes = await this.fileChangesIndicator.all();
    const fileChanges = [];
    
    for (const change of changes) {
      const fileName = await change.locator('[data-testid="file-name"]').textContent();
      const changeType = await change.getAttribute('data-change-type');
      fileChanges.push({ fileName, changeType });
    }
    
    return fileChanges;
  }

  async retryLastMessage() {
    await this.retryButton.click();
    await this.waitForAssistantResponse();
  }

  async openCommandPalette() {
    await this.commandPaletteButton.click();
    await this.commandPalette.waitFor({ state: 'visible' });
  }

  async executeCommand(commandName) {
    await this.openCommandPalette();
    await this.page.fill('[data-testid="command-search"]', commandName);
    await this.page.click(`[data-testid="command-${commandName}"]`);
  }

  async isTyping() {
    return await this.typingIndicator.isVisible();
  }

  async hasError() {
    return await this.errorMessage.isVisible();
  }

  async getErrorMessage() {
    if (await this.hasError()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  async scrollToBottom() {
    await this.messageList.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async scrollToTop() {
    await this.messageList.evaluate(el => {
      el.scrollTop = 0;
    });
  }
}