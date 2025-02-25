import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists synchronously to avoid startup delays
try {
  fs.mkdirSync('logs', { recursive: true });
} catch (error) {
  console.error('Failed to create logs directory:', error.message);
}

// Create the logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'docs2context' },
  transports: [
    // Write to log files
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Helper functions with color formatting
const logInfo = (message) => {
  logger.info(message);
};

const logSuccess = (message) => {
  logger.info(`✓ ${message}`);
};

const logWarning = (message) => {
  logger.warn(message);
};

const logError = (message, error) => {
  if (error) {
    logger.error(`${message}: ${error.message}`, { stack: error.stack });
  } else {
    logger.error(message);
  }
};

const logDebug = (message) => {
  logger.debug(message);
};

export { 
  logger, 
  logInfo, 
  logSuccess, 
  logWarning, 
  logError, 
  logDebug 
};