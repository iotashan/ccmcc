# Changelog

All notable changes to Claude Code Mission Control Center (CCMCC) will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Complete rebranding from Claude Code UI to Claude Code Mission Control Center (CCMCC)
- Enhanced security warnings emphasizing local network only usage
- SETUP_CLIENT.md documentation for detailed client setup instructions
- GitHub integration features:
  - Issue templates for bug reports and feature requests
  - Pull request template
  - Contributing guidelines
- Improved README.md focused on end-user experience
- Multi-project and multi-machine capabilities emphasis in documentation

### Changed

- Project name throughout codebase to CCMCC
- Repository references to iotashan/ccmcc
- README.md restructured for better user experience
- Moved technical documentation to separate files

### Fixed

- Bash output now displays properly formatted like a terminal in chat
- Direct session URL navigation now loads chat correctly
- Various UI improvements for multi-machine management

### Security

- Added prominent warnings about local network only usage
- Emphasized that CCMCC is not hardened for public internet exposure
- Clarified intended use cases (VMs, Docker containers, local network computers)


## About This Fork

CCMCC is a fork of [Claude Code UI](https://github.com/siteboon/claudecodeui)
with enhancements focused on:

- Multi-project management capabilities
- Cross-machine control features
- Unified mission control interface
- Enhanced session management

The first official CCMCC release will be version 2.0.0 to differentiate from
the original Claude Code UI versioning.

