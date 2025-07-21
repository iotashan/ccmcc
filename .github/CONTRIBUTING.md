# Contributing to CCMCC

First off, thank you for considering contributing to Claude Code Mission Control Center! It's people like you that make CCMCC such a great tool for developers managing multiple AI-assisted coding projects.

## Code of Conduct

By participating in this project, you are expected to uphold our values of respect, collaboration, and constructive communication.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible using our bug report template.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please use our feature request template and provide as much detail as possible.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code follows the existing code style.
5. Issue that pull request!

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ccmcc.git
   cd ccmcc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `/src` - React frontend components
- `/server` - Express backend server
- `/client` - Remote machine client
- `/shared` - Shared utilities between server and client
- `/claude-docs` - Documentation

## Testing Multi-Machine Features

To test multi-machine capabilities:

1. Run the main server on one machine
2. Install and run the client on another machine
3. Connect using the client configuration

## Attribution

This project is a fork of [Claude Code UI](https://github.com/siteboon/claudecodeui). We maintain compatibility where possible while adding our multi-project and multi-machine enhancements.

## Questions?

Feel free to open an issue with your questions or reach out to the maintainers.

Thank you for contributing to CCMCC! 🚀