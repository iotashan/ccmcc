# PRD: Test Infrastructure Cleanup & Unification

## Document Information
- **Version**: 1.0
- **Created**: 2025-01-25
- **Status**: Planning
- **Priority**: High
- **Owner**: Development Team

## Executive Summary

This PRD outlines the requirements and implementation plan for cleaning up and unifying the current fragmented test infrastructure into two streamlined commands that handle the complete testing pipeline from unit tests through end-to-end testing with proper Docker orchestration.

## Problem Statement

### Current Issues
The project currently has a complex and fragmented test setup with:
- **15+ redundant test commands** in package.json that create confusion
- **Inconsistent test execution** patterns across different test types
- **Incomplete pipeline integration** - unit tests, Docker setup, and E2E tests run separately
- **Manual Docker orchestration** that is error-prone and inconsistent
- **Unused test scripts and configurations** cluttering the codebase
- **No unified developer debugging experience** for the full test pipeline

### Business Impact
- **Developer productivity loss** due to complex test setup procedures
- **CI/CD reliability issues** from inconsistent test execution
- **Maintenance overhead** from multiple test configurations
- **Inconsistent test environments** between local development and CI
- **Difficult debugging** when tests fail in the Docker pipeline

## Objectives

### Primary Goals
1. **Unify test execution** into two clean commands: `npm test` and `npm run test:dev`
2. **Complete pipeline automation** from unit tests through E2E testing with Docker orchestration
3. **Clean up redundant configurations** and remove unused test scripts
4. **Provide developer-friendly debugging** with headed browser and pause capabilities
5. **Maintain test reliability** while simplifying the execution process

### Success Criteria
- ✅ Single `npm test` command runs complete CI pipeline reliably
- ✅ Single `npm run test:dev` provides developer debugging experience  
- ✅ All redundant test commands removed from package.json
- ✅ Complete automation: unit tests → Docker server → account creation → API key → Docker client → E2E tests
- ✅ Developer mode includes headed browser with 20-second pauses between steps
- ✅ Clean error handling and automatic cleanup on failures
- ✅ Clear progress logging throughout the pipeline

## Current State Analysis

### Existing Infrastructure
The project already has solid Docker infrastructure in place:

#### Docker Configuration
- **Dockerfile.test**: Multi-stage build with server, client, and test-runner stages
- **docker-compose.test.yml**: Complete service orchestration with proper networking
- **Scripts**: `test-ci.sh` and `test-developer.sh` handle Docker orchestration

#### Test Framework Setup
- **Jest**: Unit and integration tests configured
- **Playwright**: E2E tests with proper browser setup
- **Docker Services**: Server initialization, client connection, test execution

#### Current Package.json Scripts (to be cleaned up)
```json
{
  "test": "npm run test:all",
  "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
  "test:unit": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --testMatch='<rootDir>/tests/unit/**/*.test.js'",
  "test:integration": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --testMatch='<rootDir>/tests/integration/**/*.test.js'",
  "test:e2e": "playwright test --config=tests/config/playwright.config.js",
  "test:e2e:ui": "playwright test --config=tests/config/playwright.config.js --ui",
  "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --coverage",
  "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --watch",
  "test:debug": "node --inspect-brk node_modules/.bin/jest --config=tests/config/jest.config.mjs --runInBand",
  "test:performance": "playwright test --config=tests/config/playwright.config.js --grep='@performance'",
  "test:dev": "DEVELOPER_MODE=true npm run test:e2e",
  "test:dev:setup": "./scripts/test-developer.sh setup",
  "test:dev:run": "./scripts/test-developer.sh run",
  "test:dev:teardown": "./scripts/test-developer.sh teardown",
  "test:dev:full": "./scripts/test-developer.sh full",
  "test:ci:run": "./scripts/test-ci.sh"
}
```

### Issues with Current Approach
1. **Fragmented execution**: Unit tests run separately from Docker pipeline
2. **Redundant commands**: Multiple ways to run the same tests
3. **Incomplete integration**: Current `npm test` doesn't use Docker infrastructure
4. **Poor developer experience**: `test:dev` doesn't use the proper developer script

## Proposed Solution

### Target Architecture

```
npm test -----> test-ci.sh -----> Unit Tests -> Integration Tests -> Docker Server -> Account/API Key -> Docker Client -> E2E Tests
                                                                          |
                                                                     (headless, CI mode)

npm run test:dev -> test-developer.sh -> Unit Tests -> Integration Tests -> Docker Server -> Account/API Key -> Docker Client -> E2E Tests
                                                                                   |
                                                                              (headed, 20s pauses)
```

### New Package.json Scripts (Simplified)
```json
{
  "scripts": {
    "test": "./scripts/test-ci.sh",
    "test:dev": "./scripts/test-developer.sh full",
    "test:unit:raw": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --testMatch='<rootDir>/tests/unit/**/*.test.js'",
    "test:integration:raw": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/config/jest.config.mjs --testMatch='<rootDir>/tests/integration/**/*.test.js'"
  }
}
```

### Enhanced Shell Scripts

#### test-ci.sh Enhancements
- Add unit test execution at the beginning
- Add integration test execution 
- Maintain existing Docker pipeline
- Improve error handling and cleanup

#### test-developer.sh Enhancements  
- Add unit test execution at the beginning
- Add integration test execution
- Ensure 20-second pause configuration
- Maintain headed browser mode
- Keep containers running for debugging

## Implementation Plan

### Phase 1: Update Package.json (High Priority)
**Timeline**: Day 1  
**Effort**: 30 minutes

**Tasks:**
1. Replace 15+ test scripts with 2 clean commands
2. Add minimal "raw" commands for internal use by shell scripts
3. Remove all redundant test configurations

**Files Modified:**
- `package.json`

**Acceptance Criteria:**
- Only 4 test-related scripts remain in package.json
- `npm test` points to CI script
- `npm run test:dev` points to developer script

### Phase 2: Enhance test-ci.sh (High Priority)
**Timeline**: Day 1  
**Effort**: 1 hour

**Tasks:**
1. Add unit test execution at script start
2. Add integration test execution after unit tests
3. Ensure proper error handling and early exit on test failures
4. Maintain existing Docker pipeline functionality

**Code Changes:**
```bash
# Add after initial setup
print_status "Running unit tests..."
npm run test:unit:raw || {
    print_error "Unit tests failed"
    exit 1
}

print_status "Running integration tests..."
npm run test:integration:raw || {
    print_error "Integration tests failed"
    exit 1
}

# Continue with existing Docker pipeline...
```

**Files Modified:**
- `scripts/test-ci.sh`

**Acceptance Criteria:**
- Unit tests run first and fail fast
- Integration tests run after unit tests
- Docker pipeline only starts if unit/integration tests pass
- Clean error reporting and exit codes

### Phase 3: Enhance test-developer.sh (High Priority)
**Timeline**: Day 1  
**Effort**: 1 hour

**Tasks:**
1. Add unit test execution in setup() function
2. Add integration test execution after unit tests
3. Verify 20-second pause configuration is working
4. Ensure headed browser mode is maintained

**Code Changes:**
```bash
# Add in setup() function before Docker start
print_status "Running unit tests first..."
npm run test:unit:raw || {
    print_error "Unit tests failed"
    exit 1
}

print_status "Running integration tests..."
npm run test:integration:raw || {
    print_error "Integration tests failed"
    exit 1
}

# Ensure pause configuration
export DEVELOPER_PAUSE_DURATION=${DEVELOPER_PAUSE_DURATION:-20}
```

**Files Modified:**
- `scripts/test-developer.sh`

**Acceptance Criteria:**
- Unit tests run before Docker setup in developer mode
- 20-second pauses are properly configured
- Tests run in headed browser mode
- Containers remain running for debugging

### Phase 4: Clean Up Unused Configurations (Medium Priority)
**Timeline**: Day 2  
**Effort**: 30 minutes

**Tasks:**
1. Review all test-related files for unused configurations
2. Remove redundant test scripts if any exist
3. Clean up orphaned test result directories
4. Update any documentation references to old test commands

**Files Reviewed:**
- All files in `scripts/` directory
- Test configuration files
- Documentation files

**Acceptance Criteria:**
- No unused test scripts remain
- No broken references to old test commands
- Clean test result directory structure

### Phase 5: Verification Testing (High Priority)
**Timeline**: Day 2  
**Effort**: 2 hours

**Tasks:**
1. Test `npm test` end-to-end with clean environment
2. Test `npm run test:dev` end-to-end with clean environment
3. Verify error handling works correctly
4. Test cleanup procedures
5. Validate Docker container orchestration

**Test Scenarios:**
- Complete successful pipeline run
- Unit test failure handling
- Integration test failure handling
- Docker service startup failure handling
- Network connectivity issues
- Cleanup after test failures

**Acceptance Criteria:**
- Both commands work reliably from clean state
- Proper error messages and exit codes
- Clean environment after test runs
- Docker containers properly cleaned up

## Technical Specifications

### Complete Test Pipeline Flow

#### CI Mode (`npm test`)
1. **Unit Tests**: Jest with Node.js experimental modules
2. **Integration Tests**: Jest with test database
3. **Docker Build**: Server and client images from multi-stage Dockerfile
4. **Server Start**: Express server with SQLite database
5. **Server Init**: Create test user account and API key
6. **Client Start**: Connect client to server using API key
7. **E2E Tests**: Playwright in headless mode
8. **Cleanup**: Stop and remove all Docker containers
9. **Results**: Exit with proper status code

#### Developer Mode (`npm run test:dev`)
1. **Unit Tests**: Same as CI mode
2. **Integration Tests**: Same as CI mode
3. **Docker Build**: Same as CI mode
4. **Server Start**: Same as CI mode
5. **Server Init**: Same as CI mode
6. **Client Start**: Same as CI mode
7. **E2E Tests**: Playwright in headed mode with 20s pauses
8. **Debug Mode**: Keep containers running for inspection
9. **Manual Cleanup**: Developer runs teardown when ready

### Environment Variables

#### CI Mode
```bash
CI=true
DEVELOPER_MODE=false
HEADLESS=true
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

#### Developer Mode
```bash
CI=false
DEVELOPER_MODE=true
DEVELOPER_PAUSE_DURATION=20
HEADLESS=false
```

### Error Handling Strategy

#### Fail-Fast Approach
- Unit test failures exit immediately
- Integration test failures exit immediately  
- Docker build failures exit immediately
- Service startup failures exit after retry attempts

#### Cleanup Guarantees
- Docker containers always cleaned up on exit
- Temporary files removed
- Network resources released
- Proper exit codes returned

### Performance Considerations

#### CI Mode Optimizations
- Parallel Docker builds where possible
- Cached test data volumes
- Optimized Playwright browser installations
- Shared network for service communication

#### Developer Mode Features
- Live container logs for debugging
- Port forwarding to host machine
- Volume mounts for real-time code changes
- Browser dev tools access

## Risk Assessment

### High Risk
- **Docker orchestration complexity**: Mitigation through extensive testing
- **Service startup timing**: Mitigation through proper health checks and retries
- **Network port conflicts**: Mitigation through configurable ports

### Medium Risk
- **Test data consistency**: Mitigation through proper test isolation
- **Browser driver compatibility**: Mitigation through locked Playwright versions

### Low Risk
- **Script compatibility across platforms**: Mitigation through POSIX-compliant shell scripts
- **Environment variable conflicts**: Mitigation through prefixed variable names

## Dependencies

### External Dependencies
- Docker and Docker Compose
- Node.js 20+
- Playwright browsers
- Jest testing framework

### Internal Dependencies
- Existing Docker configuration files
- Test specifications and fixtures
- Server and client application code

### Backward Compatibility
- No breaking changes to test content
- Existing test files remain unchanged
- Docker configurations preserved

## Success Metrics

### Quantitative Metrics
- **Test execution time**: Baseline current vs. new approach
- **Failure rate reduction**: Compare stability over 30 days
- **Developer onboarding time**: Measure new developer setup time
- **CI build reliability**: Track success rate over time

### Qualitative Metrics
- **Developer satisfaction**: Survey team on new test experience
- **Debugging efficiency**: Measure time to resolve test failures
- **Maintenance overhead**: Assess ongoing configuration management

## Rollback Plan

### Immediate Rollback (If Critical Issues)
1. Revert package.json to previous version
2. Restore original test scripts
3. Document issues encountered
4. Plan remediation approach

### Rollback Procedure
```bash
# Emergency rollback commands
git checkout HEAD~1 -- package.json
git checkout HEAD~1 -- scripts/test-ci.sh
git checkout HEAD~1 -- scripts/test-developer.sh
npm install
```

### Rollback Triggers
- Complete test pipeline failure
- Inability to run tests locally
- CI/CD system failures
- Critical Docker orchestration issues

## Post-Implementation

### Monitoring
- Track test execution metrics
- Monitor Docker resource usage
- Watch for test flakiness patterns
- Collect developer feedback

### Documentation Updates
- Update README with new test commands
- Create troubleshooting guide
- Document environment setup requirements
- Update CI/CD pipeline documentation

### Future Enhancements
- Parallel test execution optimization
- Test result reporting improvements
- Additional developer debugging tools
- Performance test integration

## Conclusion

This test infrastructure cleanup will significantly improve developer productivity and test reliability by:
- **Simplifying** the test execution process to just two commands
- **Automating** the complete pipeline from unit tests to E2E tests
- **Providing** excellent developer debugging capabilities
- **Maintaining** all existing test coverage and reliability
- **Reducing** maintenance overhead and configuration complexity

The implementation plan is low-risk with clear rollback procedures and focuses on leveraging the existing solid Docker infrastructure while providing a much cleaner developer interface.