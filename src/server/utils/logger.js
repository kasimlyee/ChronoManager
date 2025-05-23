const fs = require("fs");
const path = require("path");
const util = require("util");
const { format } = require("date-fns");
const chalk = require("chalk"); // For colored console output (optional)

class Logger {
  constructor(options = {}) {
    // Default configuration
    this.options = {
      logLevel: process.env.LOG_LEVEL || "info", // 'error', 'warn', 'info', 'debug'
      logToConsole: true,
      logToFile: true,
      logDirectory: path.join(__dirname, "../logs"),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...options,
    };

    // Ensure log directory exists
    if (this.options.logToFile && !fs.existsSync(this.options.logDirectory)) {
      fs.mkdirSync(this.options.logDirectory, { recursive: true });
    }

    // Log level priority
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  // Get current log file path
  getCurrentLogFile() {
    const date = format(new Date(), "yyyy-MM-dd");
    return path.join(this.options.logDirectory, `app_${date}.log`);
  }

  // Rotate log file if it exceeds max size
  rotateLogFile() {
    if (!this.options.logToFile) return;

    const logFile = this.getCurrentLogFile();
    try {
      const stats = fs.existsSync(logFile) ? fs.statSync(logFile) : null;
      if (stats && stats.size > this.options.maxFileSize) {
        const timestamp = format(new Date(), "HH-mm-ss");
        const rotatedFile = path.join(
          this.options.logDirectory,
          `app_${timestamp}.log`
        );
        fs.renameSync(logFile, rotatedFile);
      }
    } catch (err) {
      console.error("Log rotation failed:", err);
    }
  }

  // Format log message
  formatMessage(level, message, ...args) {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS");
    const formattedArgs = args
      .map((arg) =>
        typeof arg === "object"
          ? util.inspect(arg, { depth: 3, colors: false })
          : arg
      )
      .join(" ");

    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedArgs}\n`;
  }

  // Write log to file
  writeToFile(message) {
    if (!this.options.logToFile) return;

    try {
      this.rotateLogFile();
      fs.appendFileSync(this.getCurrentLogFile(), message);
    } catch (err) {
      console.error("Failed to write log to file:", err);
    }
  }

  // Colored console output (optional)
  getConsoleColor(level) {
    switch (level) {
      case "error":
        return chalk.red;
      case "warn":
        return chalk.yellow;
      case "info":
        return chalk.cyan;
      case "debug":
        return chalk.magenta;
      default:
        return chalk.white;
    }
  }

  // Log method
  log(level, message, ...args) {
    if (this.levels[level] > this.levels[this.options.logLevel]) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    //if (this.options.logToConsole) {
    //const color = this.getConsoleColor(level);
    // console[level](this.getConsoleColor(level)(formattedMessage.trim()));
    //}

    if (this.options.logToFile) {
      this.writeToFile(formattedMessage);
    }
  }

  // Shortcut methods
  error(message, ...args) {
    this.log("error", message, ...args);
  }
  warn(message, ...args) {
    this.log("warn", message, ...args);
  }
  info(message, ...args) {
    this.log("info", message, ...args);
  }
  debug(message, ...args) {
    this.log("debug", message, ...args);
  }
}

// Singleton instance (recommended)
module.exports = new Logger();

// Alternative: Export class for custom instances
//module.exports = Logger;
