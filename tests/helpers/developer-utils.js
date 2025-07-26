// tests/helpers/developer-utils.js
import { test } from '@playwright/test';

const isDeveloperMode = process.env.DEVELOPER_MODE === 'true';
const pauseDuration = parseInt(process.env.DEVELOPER_PAUSE_DURATION || '20', 10);

/**
 * Pauses execution before navigation in developer mode
 * Shows a countdown timer in the console
 * @param {Page} page - Playwright page object
 * @param {number} customDuration - Optional custom duration in seconds
 */
export async function pauseBeforeNavigation(page, customDuration) {
  if (!isDeveloperMode) return;
  
  const duration = customDuration || pauseDuration;
  console.log(`\n🔵 Developer Mode: Pausing ${duration}s before navigation...`);
  await showCountdown(duration);
}

/**
 * Pauses execution before closing page/browser in developer mode
 * Shows a countdown timer in the console
 * @param {Page} page - Playwright page object
 * @param {number} customDuration - Optional custom duration in seconds
 */
export async function pauseBeforeClose(page, customDuration) {
  if (!isDeveloperMode) return;
  
  const duration = customDuration || pauseDuration;
  console.log(`\n🔴 Developer Mode: Pausing ${duration}s before closing...`);
  await showCountdown(duration);
}

/**
 * Shows a countdown timer in the console
 * Can be interrupted with Ctrl+C
 * @param {number} seconds - Duration in seconds
 */
async function showCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r  ${i} seconds remaining... (Press Ctrl+C to skip)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\r                                                    \r');
}

/**
 * Logs current mode information at test start
 */
export function logTestMode() {
  if (isDeveloperMode) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 DEVELOPER MODE ACTIVE');
    console.log(`   - Tests will run in headed mode`);
    console.log(`   - Pauses enabled: ${pauseDuration}s before navigation/close`);
    console.log(`   - Server URL: ${process.env.SERVER_URL || 'http://localhost:3020'}`);
    console.log(`   - Client URL: ${process.env.CLIENT_URL || 'http://localhost:3021'}`);
    console.log('='.repeat(60) + '\n');
  } else {
    console.log('\n🚀 Running tests in CI mode (headless)\n');
  }
}

/**
 * Gets the appropriate base URL based on the mode
 */
export function getBaseURL() {
  if (isDeveloperMode) {
    return process.env.CLIENT_URL || 'http://localhost:3021';
  }
  return process.env.CLIENT_URL || 'http://client:3021';
}

/**
 * Gets the appropriate server URL based on the mode
 */
export function getServerURL() {
  if (isDeveloperMode) {
    return process.env.SERVER_URL || 'http://localhost:3020';
  }
  return process.env.SERVER_URL || 'http://server:3020';
}

// Handle graceful shutdown
let skipRemainingPauses = false;

process.on('SIGINT', () => {
  if (isDeveloperMode) {
    console.log('\n\n⏩ Skipping remaining pauses...');
    skipRemainingPauses = true;
    process.exit(0);
  }
});

export { isDeveloperMode, pauseDuration };