import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class Logger {
  private logLevel: LogLevel;
  private logFile?: WriteStream;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.initializeLogFile();
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    return Object.values(LogLevel).includes(envLevel as LogLevel) 
      ? envLevel as LogLevel 
      : LogLevel.INFO;
  }

  private initializeLogFile(): void {
    if (process.env.NODE_ENV !== 'development') {
      const logPath = join(process.cwd(), 'logs', 'api.log');
      this.logFile = createWriteStream(logPath, { flags: 'a' });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  }

  private writeLog(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Always log to console
    console.log(formattedMessage);
    
    // Log to file in production
    if (this.logFile) {
      this.logFile.write(formattedMessage + '\n');
    }
  }

  error(message: string, meta?: any): void {
    this.writeLog(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: any): void {
    this.writeLog(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: any): void {
    this.writeLog(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: any): void {
    this.writeLog(LogLevel.DEBUG, message, meta);
  }
}

export const logger = new Logger();