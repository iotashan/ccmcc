# Advanced E2E Tests

**Status: 🔄 Ready for Implementation**  
**Total Tests: ~20 test scenarios**  
**Completion: 0/20 tests implemented**

## Test Implementation Checklist

### Multi-Machine Workflow (`/tests/e2e/specs/multi-machine.spec.js`)
- [ ] Cross-Machine Synchronization (1 test) - `multi-machine.spec.js:Cross-Machine-Sync`
- [ ] Machine Disconnection/Reconnection (1 test) - `multi-machine.spec.js:Machine-Disconnect`

### Error Handling (`/tests/e2e/specs/error-handling.spec.js`)
- [ ] Network Failures and Recovery (1 test) - `error-handling.spec.js:Network-Failures`
- [ ] Concurrent Edit Conflicts (1 test) - `error-handling.spec.js:Edit-Conflicts`
- [ ] Server Error Recovery (1 test) - `error-handling.spec.js:Server-Errors`

### Mobile Responsiveness (`/tests/e2e/specs/mobile.spec.js`)
- [ ] Mobile Layout (1 test) - `mobile.spec.js:Mobile-Layout`
- [ ] Tablet Optimization (1 test) - `mobile.spec.js:Tablet-Layout`
- [ ] Mobile Accessibility (1 test) - `mobile.spec.js:Mobile-A11y`

### Accessibility (`/tests/e2e/specs/accessibility.spec.js`)
- [ ] Keyboard Navigation (1 test) - `accessibility.spec.js:Keyboard-Nav`
- [ ] Screen Reader Compatibility (1 test) - `accessibility.spec.js:Screen-Reader`
- [ ] Visual Accessibility (1 test) - `accessibility.spec.js:Visual-A11y`

### Performance Edge Cases (`/tests/e2e/specs/performance-edge-cases.spec.js`)
- [ ] Large Projects (1 test) - `performance-edge-cases.spec.js:Large-Projects`
- [ ] Massive Chat Conversations (1 test) - `performance-edge-cases.spec.js:Massive-Chat`
- [ ] Multiple Simultaneous Operations (1 test) - `performance-edge-cases.spec.js:Concurrent-Ops`

**Progress: 0/13 advanced E2E test scenarios completed**

This document contains detailed specifications for advanced end-to-end tests in the Claude Code UI Docker test environment.

## Overview

Advanced E2E tests cover complex scenarios and edge cases:
- **Multi-Machine Workflow** - Cross-machine synchronization
- **Error Handling** - Network failures and recovery
- **Mobile Responsiveness** - Mobile and tablet layouts
- **Accessibility** - Screen reader and keyboard navigation
- **Performance Edge Cases** - Large datasets and stress scenarios

---

## Multi-Machine Workflow (`/tests/e2e/specs/multi-machine.spec.js`)

### Cross-Machine Synchronization

```javascript
describe('Multi-Machine Workflow', () => {
  test('work across multiple machines', async ({ browser }) => {
    // Setup: Create two browser contexts (simulating different machines)
    const machine1 = await browser.newContext({
      userAgent: 'Machine1-UserAgent'
    });
    const machine2 = await browser.newContext({
      userAgent: 'Machine2-UserAgent'
    });
    
    const page1 = await machine1.newPage();
    const page2 = await machine2.newPage();
    
    // 1. Login on machine 1
    await loginTestUser(page1);
    await page1.waitForSelector('[data-testid="machine-id"]');
    const machine1Id = await page1.textContent('[data-testid="machine-id"]');
    
    // Verify machine registration
    await expect(page1.locator('[data-testid="machine-name"]')).toContainText('Machine1');
    
    // 2. Login on machine 2
    await loginTestUser(page2);
    const machine2Id = await page2.textContent('[data-testid="machine-id"]');
    
    // Verify both machines are different
    expect(machine1Id).not.toBe(machine2Id);
    
    // 3. Open project on machine 1
    await page1.click('[data-testid="project-sync-test"]');
    await page1.waitForURL(/\/projects\/sync-test/);
    
    // 4. Make changes on machine 1
    await page1.click('[data-testid="file-index.js"]');
    await page1.fill('[data-testid="editor"]', '// Changed on machine 1\nconsole.log("Hello from machine 1");');
    await page1.keyboard.press('Control+S');
    
    // Verify file saved locally
    await expect(page1.locator('[data-testid="file-saved-indicator"]')).toBeVisible();
    
    // 5. Switch to machine 2 and verify sync
    await page2.click('[data-testid="project-sync-test"]');
    await page2.waitForURL(/\/projects\/sync-test/);
    await page2.click('[data-testid="file-index.js"]');
    
    // Wait for sync to complete
    await expect(page2.locator('[data-testid="editor"]')).toContainText('// Changed on machine 1');
    await expect(page2.locator('[data-testid="sync-indicator"]')).toHaveText('synced');
    
    // 6. Check machine status
    await page1.click('[data-testid="machines-dropdown"]');
    await expect(page1.locator(`[data-testid="machine-${machine2Id}-status"]`)).toHaveText('online');
    await expect(page1.locator('[data-testid="total-machines"]')).toHaveText('2');
    
    // 7. Simultaneous editing
    await page1.fill('[data-testid="editor"]', '// Machine 1 edit\nconsole.log("From machine 1");');
    await page2.fill('[data-testid="editor"]', '// Machine 2 edit\nconsole.log("From machine 2");');
    
    // Save both (should trigger conflict resolution)
    await page1.keyboard.press('Control+S');
    await page2.keyboard.press('Control+S');
    
    // One should show conflict dialog
    await expect(page2.locator('[data-testid="conflict-resolution"]')).toBeVisible({ timeout: 5000 });
    
    // Cleanup
    await machine1.close();
    await machine2.close();
  });

  test('machine disconnection and reconnection', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Setup connected machines
    await loginTestUser(page1, 'user@example.com', 'password');
    await loginTestUser(page2, 'user@example.com', 'password');
    
    await page1.click('[data-testid="project-connection-test"]');
    await page2.click('[data-testid="project-connection-test"]');
    
    // Verify both connected
    await expect(page1.locator('[data-testid="connected-machines"]')).toHaveText('2');
    
    // 1. Simulate machine 2 going offline
    await context2.setOffline(true);
    
    // Machine 1 should detect disconnection
    await expect(page1.locator('[data-testid="connected-machines"]')).toHaveText('1', { timeout: 10000 });
    await expect(page1.locator('[data-testid="machine-disconnected-notification"]')).toBeVisible();
    
    // 2. Make changes while machine 2 is offline
    await page1.click('[data-testid="file-offline-test.js"]');
    await page1.fill('[data-testid="editor"]', '// Changes made while machine 2 offline');
    await page1.keyboard.press('Control+S');
    
    // 3. Bring machine 2 back online
    await context2.setOffline(false);
    await page2.reload(); // Simulate reconnection
    
    // 4. Verify sync resumes
    await expect(page1.locator('[data-testid="connected-machines"]')).toHaveText('2', { timeout: 15000 });
    
    // Machine 2 should receive missed changes
    await page2.click('[data-testid="file-offline-test.js"]');
    await expect(page2.locator('[data-testid="editor"]')).toContainText('// Changes made while machine 2 offline');
    
    await context1.close();
    await context2.close();
  });
});
```

---

## Error Handling (`/tests/e2e/specs/error-handling.spec.js`)

### Network Failures and Recovery

```javascript
describe('Error Handling', () => {
  test('handles network failures gracefully', async ({ page, context }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-network-test"]');
    
    // 1. Start editing a file
    await page.click('[data-testid="file-config.json"]');
    await page.fill('[data-testid="editor"]', '{"updated": true, "timestamp": "' + new Date().toISOString() + '"}');
    
    // 2. Simulate network failure
    await context.setOffline(true);
    
    // 3. Try to save
    await page.keyboard.press('Control+S');
    
    // 4. Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-message"]')).toContainText('Connection lost');
    
    // 5. Changes should be queued
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveText('1');
    await expect(page.locator('[data-testid="unsaved-indicator"]')).toBeVisible();
    
    // 6. Try other operations while offline
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-name"]', 'offline-created.js');
    await page.click('[data-testid="create-file"]');
    
    // Should queue the operation
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveText('2');
    
    // 7. Restore network
    await context.setOffline(false);
    
    // 8. Should auto-sync
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="reconnecting"]')).toBeVisible();
    
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveText('0', { timeout: 10000 });
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible();
    
    // Verify all changes were applied
    await page.reload();
    await page.click('[data-testid="file-config.json"]');
    await expect(page.locator('[data-testid="editor"]')).toContainText('"updated": true');
    await expect(page.locator('[data-testid="file-offline-created.js"]')).toBeVisible();
  });

  test('handles concurrent edit conflicts', async ({ browser }) => {
    // Two users edit same file
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await loginTestUser(page1, 'user1@example.com', 'password1');
    await loginTestUser(page2, 'user2@example.com', 'password2');
    
    // Both join the same project
    await page1.click('[data-testid="project-conflict-test"]');
    await page2.click('[data-testid="project-conflict-test"]');
    
    // Both open same file
    await page1.click('[data-testid="file-shared-component.js"]');
    await page2.click('[data-testid="file-shared-component.js"]');
    
    // Both edit different parts initially
    await page1.click('[data-testid="editor"]');
    await page1.press('Control+Home'); // Go to start
    await page1.type('[data-testid="editor"]', '// User 1 header comment\n');
    
    await page2.click('[data-testid="editor"]');
    await page2.press('Control+End'); // Go to end
    await page2.type('[data-testid="editor"]', '\n// User 2 footer comment');
    
    // Save both (should merge successfully)
    await page1.keyboard.press('Control+S');
    await page2.keyboard.press('Control+S');
    
    // Wait for merge to complete
    await page.waitForTimeout(2000);
    
    // Both should see merged content
    await expect(page1.locator('[data-testid="editor"]')).toContainText('User 1 header comment');
    await expect(page1.locator('[data-testid="editor"]')).toContainText('User 2 footer comment');
    
    // Now create actual conflict - both edit same line
    const originalContent = await page1.locator('[data-testid="editor"]').inputValue();
    
    await page1.fill('[data-testid="editor"]', originalContent.replace('function', 'async function'));
    await page2.fill('[data-testid="editor"]', originalContent.replace('function', 'export function'));
    
    // Save both
    await page1.keyboard.press('Control+S');
    await page2.keyboard.press('Control+S');
    
    // Second save should show conflict
    await expect(page2.locator('[data-testid="conflict-dialog"]')).toBeVisible();
    await expect(page2.locator('[data-testid="conflict-options"]')).toContainText(['Keep Mine', 'Keep Theirs', 'Merge Manually']);
    
    // Choose manual merge
    await page2.click('[data-testid="merge-manually"]');
    
    // Conflict resolution interface should appear
    await expect(page2.locator('[data-testid="merge-editor"]')).toBeVisible();
    await expect(page2.locator('[data-testid="your-changes"]')).toContainText('export function');
    await expect(page2.locator('[data-testid="their-changes"]')).toContainText('async function');
    
    // Resolve conflict
    await page2.click('[data-testid="accept-theirs"]');
    await page2.click('[data-testid="save-resolution"]');
    
    // Conflict should be resolved
    await expect(page2.locator('[data-testid="conflict-resolved"]')).toBeVisible();
    
    await context1.close();
    await context2.close();
  });

  test('handles server errors and recovery', async ({ page }) => {
    await loginTestUser(page);
    
    // 1. Server error during file save
    await page.route('**/api/files/**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      } else {
        route.continue();
      }
    });
    
    await page.click('[data-testid="project-error-test"]');
    await page.click('[data-testid="file-test.js"]');
    await page.fill('[data-testid="editor"]', 'console.log("test");');
    await page.keyboard.press('Control+S');
    
    // Should show error message
    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to save file');
    
    // Retry mechanism
    await page.click('[data-testid="retry-save"]');
    await expect(page.locator('[data-testid="retrying"]')).toBeVisible();
    
    // Remove the route to simulate server recovery
    await page.unroute('**/api/files/**');
    
    // Should eventually succeed
    await expect(page.locator('[data-testid="file-saved"]')).toBeVisible({ timeout: 5000 });
    
    // 2. Authentication error recovery
    await page.route('**/api/**', route => {
      if (route.request().headers()['authorization']) {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      } else {
        route.continue();
      }
    });
    
    // Try an authenticated operation
    await page.click('[data-testid="git-status"]');
    
    // Should redirect to login
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-again"]')).toBeVisible();
    
    // Login again
    await page.click('[data-testid="login-again"]');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    // Should return to previous state
    await expect(page).toHaveURL(/\/projects\/error-test/);
  });
});
```

---

## Mobile Responsiveness (`/tests/e2e/specs/mobile.spec.js`)

### Mobile and Tablet Layouts

```javascript
describe('Mobile Experience', () => {
  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 375, height: 812 });
    
    await loginTestUser(page);
    
    // 1. Hamburger menu visible
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();
    
    // 2. Sidebar hidden by default
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    
    // 3. Open sidebar
    await page.click('[data-testid="mobile-menu"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar-overlay"]')).toBeVisible();
    
    // 4. Navigate to project
    await page.click('[data-testid="project-mobile-test"]');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible(); // Should close after navigation
    
    // 5. Editor takes full width
    const editor = page.locator('[data-testid="editor-container"]');
    const viewportWidth = 375;
    const editorBox = await editor.boundingBox();
    expect(editorBox.width).toBeCloseTo(viewportWidth, 10);
    
    // 6. Chat interface adapts
    await page.click('[data-testid="chat-tab"]');
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
    
    // Chat input should be properly sized
    const chatInput = page.locator('[data-testid="chat-input"]');
    const chatInputBox = await chatInput.boundingBox();
    expect(chatInputBox.width).toBeLessThan(viewportWidth);
    
    // 7. Touch interactions
    await page.locator('[data-testid="file-explorer-tab"]').tap();
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
    
    // 8. Swipe gestures work
    await page.locator('[data-testid="main-content"]').swipe('left', { distance: 200 });
    await expect(page.locator('[data-testid="secondary-panel"]')).toBeVisible();
    
    // 9. Virtual keyboard handling
    await page.click('[data-testid="chat-input"]');
    await page.keyboard.type('Test mobile input');
    
    // Interface should adjust for virtual keyboard
    const chatContainer = page.locator('[data-testid="chat-container"]');
    const chatContainerBox = await chatContainer.boundingBox();
    expect(chatContainerBox.height).toBeLessThan(500); // Adjusted for keyboard
  });

  test('tablet layout optimization', async ({ page }) => {
    // Set tablet viewport (iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await loginTestUser(page);
    await page.click('[data-testid="project-tablet-test"]');
    
    // 1. Sidebar should be visible but collapsible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible(); // Still available on tablet
    
    // 2. Two-panel layout
    await expect(page.locator('[data-testid="editor-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    
    // Panels should share screen space appropriately
    const editorBox = await page.locator('[data-testid="editor-panel"]').boundingBox();
    const chatBox = await page.locator('[data-testid="chat-panel"]').boundingBox();
    
    expect(editorBox.width + chatBox.width).toBeLessThanOrEqual(768);
    
    // 3. Touch-friendly controls
    const buttons = page.locator('[data-testid*="button"]');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const buttonBox = await button.boundingBox();
      if (buttonBox) {
        // Touch targets should be at least 44px
        expect(Math.min(buttonBox.width, buttonBox.height)).toBeGreaterThanOrEqual(44);
      }
    }
    
    // 4. Gesture support
    await page.locator('[data-testid="editor"]').swipe('down', { distance: 100 });
    // Should scroll or show gesture feedback
    
    // 5. Orientation change
    await page.setViewportSize({ width: 1024, height: 768 }); // Landscape
    
    // Layout should adapt
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    const landscapeEditorBox = await page.locator('[data-testid="editor-panel"]').boundingBox();
    expect(landscapeEditorBox.width).toBeGreaterThan(editorBox.width); // Wider in landscape
  });

  test('mobile accessibility features', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Enable high contrast mode simulation
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    
    await loginTestUser(page);
    await page.click('[data-testid="project-accessibility-test"]');
    
    // 1. Focus management
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Focus should be clearly visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveCSS('outline', /solid/);
    
    // 2. Screen reader support
    await expect(page.locator('[data-testid="main-content"]')).toHaveAttribute('role', 'main');
    await expect(page.locator('[data-testid="file-explorer"]')).toHaveAttribute('role', 'navigation');
    
    // 3. Touch target sizes
    const touchTargets = page.locator('[role="button"], button, [data-testid*="button"]');
    const touchTargetCount = await touchTargets.count();
    
    for (let i = 0; i < Math.min(touchTargetCount, 10); i++) {
      const target = touchTargets.nth(i);
      const targetBox = await target.boundingBox();
      
      if (targetBox) {
        expect(targetBox.width).toBeGreaterThanOrEqual(44);
        expect(targetBox.height).toBeGreaterThanOrEqual(44);
      }
    }
    
    // 4. Text scaling
    await page.addStyleTag({
      content: `
        * {
          font-size: 150% !important;
        }
      `
    });
    
    // Interface should remain usable with larger text
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
    
    // 5. High contrast support
    await expect(page.locator('body')).toHaveCSS('background-color', /rgb/);
    await expect(page.locator('[data-testid="primary-text"]')).toHaveCSS('color', /rgb/);
  });
});
```

---

## Accessibility (`/tests/e2e/specs/accessibility.spec.js`)

### Screen Reader and Keyboard Navigation

```javascript
describe('Accessibility', () => {
  test('keyboard navigation throughout application', async ({ page }) => {
    await loginTestUser(page);
    
    // 1. Tab through main navigation
    await page.keyboard.press('Tab'); // Should focus first interactive element
    await expect(page.locator(':focus')).toBeVisible();
    
    let focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('tabindex', '0');
    
    // Continue tabbing through navigation
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
    
    // 2. Skip links
    await page.keyboard.press('Tab'); // Should reach skip link
    focusedElement = page.locator(':focus');
    
    if (await focusedElement.textContent() === 'Skip to main content') {
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="main-content"]:focus')).toBeVisible();
    }
    
    // 3. Project selection via keyboard
    await page.click('[data-testid="project-accessibility-test"]'); // Start from known state
    
    // File explorer keyboard navigation
    await page.keyboard.press('F6'); // Should focus file explorer
    await expect(page.locator('[data-testid="file-explorer"]:focus-within')).toBeVisible();
    
    // Arrow key navigation in file tree
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); // Open file
    
    await expect(page.locator('[data-testid="editor"]:focus-within')).toBeVisible();
    
    // 4. Editor keyboard shortcuts
    await page.keyboard.press('Control+f'); // Find dialog
    await expect(page.locator('[data-testid="find-dialog"]')).toBeVisible();
    
    await page.keyboard.press('Escape'); // Close dialog
    await expect(page.locator('[data-testid="find-dialog"]')).not.toBeVisible();
    
    // 5. Chat interface keyboard navigation
    await page.keyboard.press('F6'); // Switch panels
    await page.keyboard.press('F6'); // Should reach chat
    
    await expect(page.locator('[data-testid="chat-input"]:focus')).toBeVisible();
    
    await page.keyboard.type('Test accessibility message');
    await page.keyboard.press('Enter');
    
    // Focus should remain in chat after sending
    await expect(page.locator('[data-testid="chat-input"]:focus')).toBeVisible();
  });

  test('screen reader compatibility', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-screen-reader-test"]');
    
    // 1. ARIA labels and descriptions
    await expect(page.locator('[data-testid="file-explorer"]')).toHaveAttribute('aria-label', 'File explorer');
    await expect(page.locator('[data-testid="editor"]')).toHaveAttribute('aria-label', /Code editor/);
    await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute('aria-label', 'Chat with AI assistant');
    
    // 2. Live regions for dynamic content
    await expect(page.locator('[data-testid="status-messages"]')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('[data-testid="error-messages"]')).toHaveAttribute('aria-live', 'assertive');
    
    // 3. Semantic structure
    await expect(page.locator('h1')).toBeVisible(); // Page should have main heading
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    
    // 4. Form labels
    const inputs = page.locator('input[type="text"], input[type="email"], textarea');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.getAttribute('aria-label') || 
                      await input.getAttribute('aria-labelledby') ||
                      await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0;
      expect(hasLabel).toBeTruthy();
    }
    
    // 5. Button descriptions
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const hasAccessibleName = await button.textContent() ||
                               await button.getAttribute('aria-label') ||
                               await button.getAttribute('aria-labelledby');
      expect(hasAccessibleName).toBeTruthy();
    }
    
    // 6. Focus indicators
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    
    // Should have visible focus indicator
    await expect(focusedElement).toHaveCSS('outline-width', /[1-9]/);
    
    // 7. Error announcements
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-name"]', ''); // Invalid name
    await page.click('[data-testid="create-file"]');
    
    // Error should be announced
    await expect(page.locator('[data-testid="error-message"]')).toHaveAttribute('role', 'alert');
  });

  test('color contrast and visual accessibility', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-visual-test"]');
    
    // 1. Test with forced colors mode
    await page.emulateMedia({ forcedColors: 'active' });
    
    // Essential elements should remain visible
    await expect(page.locator('[data-testid="primary-navigation"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    
    // 2. Test with reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Animations should be disabled or reduced
    const animatedElements = page.locator('[data-testid*="animated"], .fade-in, .slide-in');
    const animatedCount = await animatedElements.count();
    
    for (let i = 0; i < animatedCount; i++) {
      const element = animatedElements.nth(i);
      // Check that transition duration is very short or none
      const transitionDuration = await element.evaluate(el => 
        window.getComputedStyle(el).transitionDuration
      );
      expect(transitionDuration === '0s' || transitionDuration === 'none').toBeTruthy();
    }
    
    // 3. Test with high contrast theme
    await page.click('[data-testid="settings"]');
    await page.selectOption('[data-testid="theme-select"]', 'high-contrast');
    await page.click('[data-testid="save-settings"]');
    
    // Verify high contrast is applied
    const backgroundColor = await page.locator('body').evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    const textColor = await page.locator('[data-testid="primary-text"]').evaluate(el =>
      window.getComputedStyle(el).color
    );
    
    // Should have high contrast colors
    expect(backgroundColor === 'rgb(0, 0, 0)' || backgroundColor === 'rgb(255, 255, 255)').toBeTruthy();
    expect(textColor === 'rgb(255, 255, 255)' || textColor === 'rgb(0, 0, 0)').toBeTruthy();
  });
});
```

---

## Performance Edge Cases (`/tests/e2e/specs/performance-edge-cases.spec.js`)

### Large Datasets and Stress Scenarios

```javascript
describe('Performance Edge Cases', () => {
  test('handles large project with thousands of files', async ({ page }) => {
    await loginTestUser(page);
    
    // Load project with 5000+ files
    await page.click('[data-testid="project-large-scale"]');
    
    // Measure initial load time
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="file-explorer-loaded"]', { timeout: 30000 });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(10000); // Should load in under 10 seconds
    
    // 1. File explorer virtualization
    const visibleFiles = page.locator('[data-testid="file-item"]:visible');
    const visibleCount = await visibleFiles.count();
    
    // Should not render all 5000 files at once
    expect(visibleCount).toBeLessThan(100);
    
    // 2. Search performance
    const searchStart = Date.now();
    await page.fill('[data-testid="file-search"]', 'component');
    await page.waitForSelector('[data-testid="search-results"]');
    const searchTime = Date.now() - searchStart;
    
    expect(searchTime).toBeLessThan(2000); // Search should complete quickly
    
    // 3. Scroll performance
    const scrollContainer = page.locator('[data-testid="file-list"]');
    
    // Rapid scrolling should not freeze UI
    for (let i = 0; i < 10; i++) {
      await scrollContainer.evaluate(el => el.scrollTop += 500);
      await page.waitForTimeout(50);
    }
    
    // Should still be responsive
    await page.click('[data-testid="file-search"]');
    await expect(page.locator('[data-testid="file-search"]:focus')).toBeVisible();
  });

  test('handles massive chat conversation', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-chat-stress"]');
    
    // Load pre-generated session with 2000+ messages
    await page.click('[data-testid="session-stress-test"]');
    
    const loadStart = Date.now();
    await page.waitForSelector('[data-testid="chat-loaded"]', { timeout: 20000 });
    const loadTime = Date.now() - loadStart;
    
    expect(loadTime).toBeLessThan(5000); // Should load efficiently
    
    // 1. Message virtualization
    const visibleMessages = page.locator('[data-testid="message"]:visible');
    const visibleCount = await visibleMessages.count();
    
    // Should not render all 2000 messages
    expect(visibleCount).toBeLessThan(50);
    
    // 2. Scroll performance
    const chatContainer = page.locator('[data-testid="chat-messages"]');
    
    // Scroll to top rapidly
    await chatContainer.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(1000);
    
    // Should load earlier messages
    await expect(page.locator('[data-testid="message-1"]')).toBeVisible();
    
    // Scroll to bottom
    await chatContainer.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(1000);
    
    // Should show latest messages
    await expect(page.locator('[data-testid="message-latest"]')).toBeVisible();
    
    // 3. Memory usage stability
    // Check that memory doesn't grow excessively during scrolling
    const initialMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    
    // Perform intensive scrolling
    for (let i = 0; i < 20; i++) {
      await chatContainer.evaluate(el => el.scrollTop = Math.random() * el.scrollHeight);
      await page.waitForTimeout(100);
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) window.gc();
    });
    
    const finalMemory = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
    
    if (initialMemory > 0) {
      const memoryIncrease = (finalMemory - initialMemory) / initialMemory;
      expect(memoryIncrease).toBeLessThan(0.5); // Memory shouldn't increase by more than 50%
    }
  });

  test('handles multiple simultaneous operations', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-concurrent-ops"]');
    
    // Start multiple operations simultaneously
    const operations = [
      // File operations
      page.click('[data-testid="file-large-data.json"]'),
      
      // Search operation
      page.fill('[data-testid="global-search"]', 'function'),
      
      // Chat message
      page.fill('[data-testid="chat-input"]', 'Explain this code'),
      
      // Git operation
      page.click('[data-testid="git-status"]'),
      
      // Terminal command
      page.type('[data-testid="terminal-input"]', 'npm install')
    ];
    
    const startTime = Date.now();
    await Promise.allSettled(operations);
    const totalTime = Date.now() - startTime;
    
    // All operations should start without blocking
    expect(totalTime).toBeLessThan(2000);
    
    // Verify each operation completed
    await expect(page.locator('[data-testid="file-content-loaded"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="chat-sending"]')).toBeVisible();
    await expect(page.locator('[data-testid="git-status-result"]')).toBeVisible({ timeout: 5000 });
    
    // UI should remain responsive during operations
    await page.click('[data-testid="settings"]');
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
  });
});
```

---

## Test Execution Notes

### Advanced Testing Requirements
- Multi-context browser support for machine simulation
- Network condition simulation (offline, slow connections)
- Device emulation for responsive testing
- Accessibility testing tools integration
- Performance monitoring during test execution

### Stress Test Data
- Projects with 5000+ files
- Chat sessions with 2000+ messages
- Large binary files (10MB+)
- Complex git repositories with extensive history
- Concurrent user simulation datasets

### Performance Benchmarks
- Mobile interface load time: <3s
- Large project navigation: <10s
- Multi-machine sync latency: <1s
- Offline/online recovery: <5s
- Memory usage growth: <50% during stress tests

### Browser Compatibility
- Test on mobile Safari, Chrome Mobile, Firefox Mobile
- Verify touch events and gestures
- Check responsive breakpoints
- Validate accessibility across browsers

**Total Advanced E2E Tests**: ~20 comprehensive test scenarios covering multi-machine workflows, error recovery, mobile experience, accessibility, and performance edge cases.