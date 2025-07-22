# Terminal Output Rendering Test Suite

## Overview
This test suite verifies that bash terminal output is properly rendered in the chat interface, specifically addressing the bug where bash tags (`<bash-stdout>`, `<bash-stderr>`, `<bash-input>`) were displaying as raw HTML.

## Test Coverage

### 1. Basic Tag Rendering
- **bash-stdout**: Verifies standard output is rendered with gray text color
- **bash-stderr**: Verifies error output is rendered with red text color  
- **bash-input**: Verifies commands are rendered with green prompt ($) and white text

### 2. Edge Cases
- Empty stderr output (no content between tags)
- Mixed stdout and stderr in same response
- Multiple bash commands in sequence
- Special characters and HTML entities
- Multiline terminal output

### 3. Integration Points
- Terminal output in regular chat messages
- Terminal output within tool use messages
- Terminal formatting preservation across message updates

## Bug Fix Verification
The tests ensure that the fix implemented in:
- `src/components/chat/MessageBubble.jsx`
- `src/components/chat/ToolUseMessage.jsx`

properly handles all bash tag types and renders them with appropriate terminal styling instead of showing raw HTML tags.

## Running the Tests

### Local Development
```bash
# Run just this test suite
npx playwright test tests/e2e/specs/terminal-output-rendering.spec.js

# Run with UI mode for debugging
npx playwright test tests/e2e/specs/terminal-output-rendering.spec.js --ui

# Run with headed browser
npx playwright test tests/e2e/specs/terminal-output-rendering.spec.js --headed
```

### Docker Test Environment
The test is included in the full Docker test suite:
```bash
./scripts/test-docker.sh
```

## Test Data Requirements
- Test user account creation
- Mock Claude API responses that include bash terminal output
- No special test data setup required beyond standard test environment

## Debugging Tips
1. If tests fail, check that the test selectors match the actual DOM structure
2. Use Playwright's UI mode to step through tests and inspect elements
3. Check browser console for any JavaScript errors during test execution
4. Verify that the mock Claude API is returning properly formatted bash tags