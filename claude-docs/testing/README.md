# Claude Code UI Test Specifications

This directory contains comprehensive test specifications for the Claude Code UI Docker test environment, broken down into focused files for better maintainability and LLM context handling.

## Directory Structure

### Core Test Types
- [`unit-tests-server.md`](unit-tests-server.md) - Server unit test specifications (auth, API, WebSocket, database)
- [`unit-tests-client.md`](unit-tests-client.md) - Client unit test specifications (git, files, connections)
- [`integration-tests.md`](integration-tests.md) - Integration test specifications (auth flow, git workflow, file sync)
- [`e2e-tests-core.md`](e2e-tests-core.md) - Core E2E test specifications (user journeys, developer workflow)
- [`e2e-tests-advanced.md`](e2e-tests-advanced.md) - Advanced E2E tests (multi-machine, error handling, mobile)

### Performance & Security
- [`performance-tests.md`](performance-tests.md) - Load testing, stress tests, large files
- [`security-tests.md`](security-tests.md) - Authentication security, vulnerability tests
- [`multi-machine-tests.md`](multi-machine-tests.md) - Concurrent operations, machine coordination

### Missing Application Features
- [`missing-features-favorites.md`](missing-features-favorites.md) - Favorites/starred projects tests
- [`missing-features-sessions.md`](missing-features-sessions.md) - Session management tests  
- [`missing-features-git.md`](missing-features-git.md) - Advanced git features tests
- [`missing-features-search.md`](missing-features-search.md) - Search functionality tests
- [`missing-features-ui.md`](missing-features-ui.md) - UI features (themes, shortcuts, notifications)
- [`missing-features-realtime.md`](missing-features-realtime.md) - WebSocket, performance, error recovery

### Implementation Guidelines
- [`test-execution-strategy.md`](test-execution-strategy.md) - Execution strategy, parallelization, coverage
- [`test-implementation-notes.md`](test-implementation-notes.md) - Best practices, patterns, utilities

## Quick Reference

### Test Counts by Category
- **Server Unit Tests**: ~60 test specifications ⏳ 0/60 implemented
- **Client Unit Tests**: ~40 test specifications ⏳ 0/40 implemented
- **Integration Tests**: ~15 test scenarios ⏳ 0/15 implemented
- **E2E Core Tests**: ~25 test specifications ⏳ 0/25 implemented
- **E2E Advanced Tests**: ~20 test scenarios ⏳ 0/20 implemented
- **Missing Features Tests**: ~150+ test specifications ⏳ 0/150+ implemented
- **Performance Tests**: ~15 test scenarios ⏳ 0/15 implemented
- **Security Tests**: ~20 test specifications ⏳ 0/20 implemented
- **Multi-Machine Tests**: ~10 test scenarios ⏳ 0/10 implemented

### Total Coverage
- **2,800+ lines** of detailed test specifications
- **350+ individual test cases** with inputs/outputs
- **Complete coverage** of all PRD requirements
- **Ready for implementation** with specific test IDs and patterns

## Usage

Each file is self-contained and focuses on a specific testing domain. Developers and testers can work with individual files without needing the entire context.

All test specifications include:
- **Specific inputs and expected outputs**
- **Test data requirements**
- **UI interaction patterns** 
- **Error conditions and edge cases**
- **Performance expectations**
- **Security considerations**