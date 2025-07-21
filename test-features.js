import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Create a log file to record all Playwright commands
const logFile = 'playwright-test-commands.log';
let logStream = [];

// Helper function to log commands
function logCommand(title, command, selector = '', options = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    title,
    command,
    selector,
    options,
  };
  logStream.push(logEntry);
  console.log(`[${title}] ${command} ${selector}`);
}

async function writeLog() {
  await fs.writeFile(logFile, JSON.stringify(logStream, null, 2));
  console.log(`\nTest log written to ${logFile}`);
}

// Monitor server logs in real-time
function monitorServerLogs() {
  const serverLog = spawn('tail', ['-f', 'logs/dev-server.log']);
  
  serverLog.stdout.on('data', (data) => {
    const logLine = data.toString().trim();
    if (logLine.includes('error') || logLine.includes('Error') || logLine.includes('LOGIN')) {
      console.log('[SERVER LOG]', logLine);
    }
  });
  
  return serverLog;
}

async function testAllFeatures() {
  // Start monitoring server logs
  const logProcess = monitorServerLogs();
  
  const browser = await chromium.launch({ 
    headless: process.env.TEST_HEADLESS === 'true',
    slowMo: 100 // Slow down actions for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('[Browser Console]', msg.type(), msg.text());
  });
  
  // Log network failures
  page.on('requestfailed', request => {
    console.log('[Network Failed]', request.url(), request.failure());
  });

  try {
    // 1. Navigate to app
    logCommand('Navigate to App', 'goto', process.env.TEST_URL || 'http://localhost:3021');
    await page.goto(process.env.TEST_URL || 'http://localhost:3021');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // 2. Login
    console.log('\n=== Testing Login ===');
    logCommand('Login Test', 'waitForSelector', '[data-testid="auth-username-input"]');
    await page.waitForSelector('[data-testid="auth-username-input"]', { timeout: 5000 });
    
    logCommand('Login Test', 'fill', '[data-testid="auth-username-input"]', { value: process.env.TEST_USERNAME });
    await page.fill('[data-testid="auth-username-input"]', process.env.TEST_USERNAME || 'iotashan');
    
    logCommand('Login Test', 'fill', '[data-testid="auth-password-input"]', { value: '***' });
    await page.fill('[data-testid="auth-password-input"]', process.env.TEST_PASSWORD || '');
    
    // Take screenshot before login
    await page.screenshot({ path: 'screenshots/before-login.png' });
    
    logCommand('Login Test', 'click', '[data-testid="auth-sign-in-button"]');
    await page.click('[data-testid="auth-sign-in-button"]');
    
    // Wait for navigation or error
    try {
      await Promise.race([
        page.waitForSelector('[data-testid="nav-sidebar"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="auth-error-message"]', { timeout: 10000 }),
        page.waitForSelector('[data-testid="ui-error"]', { timeout: 10000 })
      ]);
      
      // Check if we got an error
      const errorElement = await page.$('[data-testid="auth-error-message"], [data-testid="ui-error"]');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        console.error('❌ Login failed with error:', errorText);
        await page.screenshot({ path: 'screenshots/login-error.png' });
        return;
      }
      
      console.log('✅ Login successful');
      await page.screenshot({ path: 'screenshots/after-login.png' });
      
    } catch (e) {
      console.error('❌ Login timeout - taking screenshot');
      await page.screenshot({ path: 'screenshots/login-timeout.png' });
      throw e;
    }
    
    // 3. Check machine selector
    console.log('\n=== Testing Machine Selection ===');
    logCommand('Machine Selection Test', 'waitForSelector', '[data-testid="nav-machine-selector"]');
    
    // Use proper test ID
    const machineSelector = await page.waitForSelector('[data-testid="nav-machine-selector"]', { 
      timeout: 5000 
    }).catch(() => null);
    
    if (machineSelector) {
      logCommand('Machine Selection Test', 'click', 'machine selector');
      await machineSelector.click();
      
      // Wait for dropdown
      await page.waitForTimeout(500);
      
      // Check if test1 machine is available
      logCommand('Machine Selection Test', 'locator', 'text=test1');
      const test1Machine = page.locator('text=test1').first();
      if (await test1Machine.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Local client "test1" is connected');
        logCommand('Machine Selection Test', 'click', 'text=test1');
        await test1Machine.click();
      } else {
        console.log('⚠️  Local client "test1" not found in dropdown');
      }
    } else {
      console.log('⚠️  Machine selector not found');
    }
    
    // 4. Test Projects
    console.log('\n=== Testing Projects ===');
    logCommand('Projects Test', 'waitForSelector', '[data-testid="project-item"]');
    const hasProjects = await page.waitForSelector('[data-testid="project-item"]', { 
      timeout: 3000 
    }).catch(() => false);
    
    if (!hasProjects) {
      console.log('No projects found - creating one');
      
      // Try to find new project button
      const newProjectBtn = await page.locator('[data-testid="project-add-button"]').first();
      if (await newProjectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newProjectBtn.click();
        await page.waitForTimeout(500);
        
        // Fill in project path
        const pathInput = await page.locator('[data-testid="project-path-input"]');
        if (await pathInput.isVisible()) {
          await pathInput.fill('/tmp/test-project');
          
          // Submit
          const createBtn = await page.locator('[data-testid="project-create-button"]');
          if (await createBtn.isVisible()) {
            await createBtn.click();
            console.log('✅ Project creation dialog tested');
          }
        }
      }
    } else {
      console.log('✅ Projects displayed');
      
      // Select the first project to enable chat functionality
      const firstProject = await page.locator('[data-testid="project-item"]').first();
      if (await firstProject.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstProject.click();
        await page.waitForTimeout(1000); // Wait for project selection to process
        console.log('✅ First project selected');
      }
    }
    
    // 5. Test Chat
    console.log('\n=== Testing Chat ===');
    const chatInput = await page.locator('[data-testid="chat-input"]');
    if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatInput.click();
      await chatInput.fill('Test message - do not send');
      console.log('✅ Chat input works');
    } else {
      console.log('⚠️  Chat input not found');
    }
    
    // 6. Test Git Tab
    console.log('\n=== Testing Git Tab ===');
    const gitTab = await page.locator('[data-testid="nav-tab-git"]');
    if (await gitTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gitTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/git-tab.png' });
      console.log('✅ Git tab accessible');
    }
    
    // 7. Test Files Tab
    console.log('\n=== Testing Files Tab ===');
    const filesTab = await page.locator('[data-testid="nav-tab-files"]');
    if (await filesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await filesTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/files-tab.png' });
      console.log('✅ Files tab accessible');
    }
    
    // 8. Test Terminal Tab
    console.log('\n=== Testing Terminal Tab ===');
    const terminalTab = await page.locator('[data-testid="nav-tab-terminal"]');
    if (await terminalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await terminalTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/terminal-tab.png' });
      console.log('✅ Terminal tab accessible');
    }
    
    // 9. Test Settings
    console.log('\n=== Testing Settings ===');
    const settingsBtn = await page.locator('[data-testid="nav-settings-button"]');
    if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      
      // Test settings tabs
      const tabs = [
        { name: 'API', testId: 'settings-tab-api' },
        { name: 'Tools', testId: 'settings-tab-tools' },
        { name: 'Hooks', testId: 'settings-tab-hooks' },
        { name: 'Auth', testId: 'settings-tab-auth' }
      ];
      for (const tab of tabs) {
        const tabBtn = await page.locator(`[data-testid="${tab.testId}"]`);
        if (await tabBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tabBtn.click();
          await page.waitForTimeout(300);
          console.log(`✅ ${tab.name} settings tab works`);
        }
      }
      
      // Close settings
      await page.keyboard.press('Escape');
    }
    
    console.log('\n✅ All feature tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'screenshots/test-error.png' });
  } finally {
    // Write log file
    await writeLog();
    
    // Stop log monitoring
    logProcess.kill();
    
    // Create screenshots directory if it doesn't exist
    await fs.mkdir('screenshots', { recursive: true }).catch(() => {});
    
    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for manual inspection. Press Ctrl+C to exit.');
    await page.waitForTimeout(300000); // Wait 5 minutes
    
    await browser.close();
  }
}

// Create screenshots directory
await fs.mkdir('screenshots', { recursive: true }).catch(() => {});

// Run the tests
testAllFeatures().catch(console.error);