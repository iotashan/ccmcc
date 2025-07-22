import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SHELL_DEFAULTS,
  createPtyConfig,
  buildShellCommand,
  generateWelcomeMessage,
  normalizeShellOutput,
  isDangerousCommand,
  getShellConfig
} from '../shell.js';

describe('Shell Utilities', () => {
  describe('SHELL_DEFAULTS', () => {
    it('should have default values', () => {
      expect(SHELL_DEFAULTS).toEqual({
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env
      });
    });
  });

  describe('createPtyConfig', () => {
    it('should create PTY config with defaults', () => {
      const config = createPtyConfig();
      
      expect(config).toEqual({
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: expect.objectContaining({
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        })
      });
    });

    it('should accept custom dimensions', () => {
      const config = createPtyConfig(120, 40);
      
      expect(config.cols).toBe(120);
      expect(config.rows).toBe(40);
    });

    it('should accept custom working directory', () => {
      const config = createPtyConfig(80, 24, '/custom/path');
      
      expect(config.cwd).toBe('/custom/path');
    });

    it('should preserve existing environment variables', () => {
      const originalEnv = process.env.USER;
      const config = createPtyConfig();
      
      expect(config.env.USER).toBe(originalEnv);
      expect(config.env.TERM).toBe('xterm-256color');
      expect(config.env.COLORTERM).toBe('truecolor');
    });
  });

  describe('buildShellCommand', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    const originalShell = process.env.SHELL;

    afterEach(() => {
      Object.defineProperty(process, 'platform', originalPlatform);
      process.env.SHELL = originalShell;
    });

    it('should build shell command for Unix platforms', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
      process.env.SHELL = '/bin/zsh';

      const command = buildShellCommand('/project/path', 'session-123');
      
      expect(command).toEqual({
        shell: '/bin/zsh',
        args: ['-l'],
        cwd: '/project/path',
        sessionId: 'session-123',
        platform: 'darwin'
      });
    });

    it('should use default bash shell when SHELL env is not set', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });
      delete process.env.SHELL;

      const command = buildShellCommand('/project/path');
      
      expect(command.shell).toBe('/bin/bash');
      expect(command.args).toEqual(['-l']);
    });

    it('should build shell command for Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      const command = buildShellCommand('C:\\project\\path', 'session-456');
      
      expect(command).toEqual({
        shell: 'cmd.exe',
        args: [],
        cwd: 'C:\\project\\path',
        sessionId: 'session-456',
        platform: 'win32'
      });
    });

    it('should handle null sessionId', () => {
      const command = buildShellCommand('/project/path');
      
      expect(command.sessionId).toBeNull();
    });
  });

  describe('generateWelcomeMessage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate terminal welcome message', () => {
      const message = generateWelcomeMessage('terminal');
      
      expect(message).toBe(
        '\r\n🚀 Terminal session started at 2024-01-01T12:00:00.000Z\r\n\r\n'
      );
    });

    it('should generate claude welcome message with session ID', () => {
      const message = generateWelcomeMessage('claude', 'abc-123', '/project');
      
      expect(message).toBe(
        '\r\n🤖 Claude session (abc-123) started at 2024-01-01T12:00:00.000Z\r\n' +
        '📁 Working directory: /project\r\n\r\n'
      );
    });

    it('should generate claude welcome message without session ID', () => {
      const message = generateWelcomeMessage('claude');
      
      expect(message).toBe(
        '\r\n🤖 Claude session started at 2024-01-01T12:00:00.000Z\r\n\r\n'
      );
    });

    it('should generate shell welcome message', () => {
      const message = generateWelcomeMessage('shell', null, '/home/user');
      
      expect(message).toBe(
        '\r\n💻 Shell session started at 2024-01-01T12:00:00.000Z\r\n' +
        '📁 Working directory: /home/user\r\n\r\n'
      );
    });

    it('should default to terminal for unknown types', () => {
      const message = generateWelcomeMessage('unknown');
      
      expect(message).toBe(
        '\r\n🚀 Terminal session started at 2024-01-01T12:00:00.000Z\r\n\r\n'
      );
    });

    it('should include project path when provided', () => {
      const message = generateWelcomeMessage('terminal', null, '/workspace/myproject');
      
      expect(message).toContain('📁 Working directory: /workspace/myproject');
    });
  });

  describe('normalizeShellOutput', () => {
    it('should convert Windows CRLF to LF', () => {
      const output = 'line1\r\nline2\r\nline3';
      const normalized = normalizeShellOutput(output);
      
      expect(normalized).toBe('line1\nline2\nline3');
    });

    it('should convert old Mac CR to LF', () => {
      const output = 'line1\rline2\rline3';
      const normalized = normalizeShellOutput(output);
      
      expect(normalized).toBe('line1\nline2\nline3');
    });

    it('should remove trailing newlines', () => {
      const output = 'line1\nline2\n\n\n';
      const normalized = normalizeShellOutput(output);
      
      expect(normalized).toBe('line1\nline2');
    });

    it('should handle mixed line endings', () => {
      const output = 'line1\r\nline2\rline3\nline4\n\n';
      const normalized = normalizeShellOutput(output);
      
      expect(normalized).toBe('line1\nline2\nline3\nline4');
    });

    it('should handle empty output', () => {
      const normalized = normalizeShellOutput('');
      expect(normalized).toBe('');
    });

    it('should preserve internal newlines', () => {
      const output = 'line1\n\nline3\n\nline5';
      const normalized = normalizeShellOutput(output);
      
      expect(normalized).toBe('line1\n\nline3\n\nline5');
    });
  });

  describe('isDangerousCommand', () => {
    it('should detect rm -rf / command', () => {
      expect(isDangerousCommand('rm -rf /')).toBe(true);
      expect(isDangerousCommand('sudo rm -rf /')).toBe(true);
      expect(isDangerousCommand('rm -rf /tmp')).toBe(false);
    });

    it('should detect fork bomb', () => {
      expect(isDangerousCommand(':(){ :|:& };:')).toBe(true);
      expect(isDangerousCommand(' :(){ :|:& };: ')).toBe(true);
      expect(isDangerousCommand(':() { echo "safe"; }')).toBe(false);
    });

    it('should detect dd overwriting disk', () => {
      expect(isDangerousCommand('dd if=/dev/zero of=/dev/sda')).toBe(true);
      expect(isDangerousCommand('dd if=/dev/urandom of=/dev/hda')).toBe(true);
      expect(isDangerousCommand('dd if=/dev/zero of=file.img')).toBe(false);
    });

    it('should detect direct disk overwrite', () => {
      expect(isDangerousCommand('cat /dev/zero >/dev/sda')).toBe(true);
      expect(isDangerousCommand('echo "data" >/dev/hda')).toBe(true);
      expect(isDangerousCommand('cat file.txt >/tmp/output')).toBe(false);
    });

    it('should detect filesystem formatting', () => {
      expect(isDangerousCommand('mkfs.ext4 /dev/sda1')).toBe(true);
      expect(isDangerousCommand('mkfs.ntfs /dev/sdb')).toBe(true);
      expect(isDangerousCommand('echo mkfs.ext4')).toBe(false);
    });

    it('should allow safe commands', () => {
      expect(isDangerousCommand('ls -la')).toBe(false);
      expect(isDangerousCommand('cd /home/user')).toBe(false);
      expect(isDangerousCommand('npm install')).toBe(false);
      expect(isDangerousCommand('git status')).toBe(false);
      expect(isDangerousCommand('rm file.txt')).toBe(false);
    });
  });

  describe('getShellConfig', () => {
    it('should return bash configuration', () => {
      const config = getShellConfig('bash');
      
      expect(config).toEqual({
        prompt: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
        rcFile: '.bashrc',
        historyFile: '.bash_history'
      });
    });

    it('should return zsh configuration', () => {
      const config = getShellConfig('zsh');
      
      expect(config).toEqual({
        prompt: '%F{green}%n@%m%f:%F{blue}%~%f%# ',
        rcFile: '.zshrc',
        historyFile: '.zsh_history'
      });
    });

    it('should return fish configuration', () => {
      const config = getShellConfig('fish');
      
      expect(config).toEqual({
        prompt: null,
        rcFile: 'config.fish',
        historyFile: 'fish_history',
        configDir: '.config/fish'
      });
    });

    it('should default to bash for unknown shells', () => {
      const config = getShellConfig('unknown');
      
      expect(config).toEqual({
        prompt: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
        rcFile: '.bashrc',
        historyFile: '.bash_history'
      });
    });

    it('should handle undefined shell type', () => {
      const config = getShellConfig();
      
      expect(config).toEqual({
        prompt: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
        rcFile: '.bashrc',
        historyFile: '.bash_history'
      });
    });
  });
});