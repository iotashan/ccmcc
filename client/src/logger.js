import chalk from 'chalk';

export class Logger {
  constructor(debug = false) {
    this.debug = debug;
  }

  info(...args) {
    console.log(chalk.blue('[INFO]'), ...args);
  }

  success(...args) {
    console.log(chalk.green('[SUCCESS]'), ...args);
  }

  warn(...args) {
    console.log(chalk.yellow('[WARN]'), ...args);
  }

  error(...args) {
    console.error(chalk.red('[ERROR]'), ...args);
  }

  debug(...args) {
    if (this.debug) {
      console.log(chalk.gray('[DEBUG]'), ...args);
    }
  }

  raw(...args) {
    console.log(...args);
  }
}