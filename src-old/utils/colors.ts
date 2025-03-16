import chalk from 'chalk';

/**
 * Color constants for consistent CLI output
 */
export const colors = {
  // System/status messages and verbose information
  system: chalk.blue,
  
  // Successful outputs
  success: chalk.green,
  
  // Errors
  error: chalk.red,
  
  // Warnings and debug information
  warning: chalk.yellow,
  
  // Neutral information (no color)
  info: (text: string) => text
};

/**
 * Helper functions for common message types
 */
export const log = {
  system: (message: string) => console.log(colors.system(message)),
  success: (message: string) => console.log(colors.success(message)),
  error: (message: string) => console.error(colors.error(message)),
  warning: (message: string) => console.warn(colors.warning(message)),
  info: (message: string) => console.log(message)
};