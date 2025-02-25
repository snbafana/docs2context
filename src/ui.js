import chalk from 'chalk';
import figlet from 'figlet';
import logSymbols from 'log-symbols';
import ora from 'ora';

/**
 * Display a styled header for the application
 */
export function displayHeader() {
  console.log(
    chalk.cyan(
      figlet.textSync('docs2context', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  );
  console.log(chalk.white.dim('Documentation scraper and aggregator CLI\n'));
}

/**
 * Create and return a spinner with consistent styling
 * @param {string} text - The text to display with the spinner
 * @returns {ora.Ora} - The spinner instance
 */
export function createSpinner(text) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots'
  });
}

/**
 * Display an info message with consistent styling
 * @param {string} message - The message to display
 */
export function displayInfo(message) {
  console.log(chalk.blue(message));
}

/**
 * Display a success message with consistent styling
 * @param {string} message - The message to display
 */
export function displaySuccess(message) {
  console.log(logSymbols.success, chalk.green(message));
}

/**
 * Display a warning message with consistent styling
 * @param {string} message - The message to display
 */
export function displayWarning(message) {
  console.log(logSymbols.warning, chalk.yellow(message));
}

/**
 * Display an error message with consistent styling
 * @param {string} message - The message to display
 */
export function displayError(message) {
  console.log(logSymbols.error, chalk.red(message));
}

/**
 * Format a URL for display
 * @param {string} url - The URL to format
 * @returns {string} - The formatted URL
 */
export function formatUrl(url) {
  return chalk.cyan.underline(url);
}

/**
 * Format a file path for display
 * @param {string} filePath - The file path to format
 * @returns {string} - The formatted file path
 */
export function formatFilePath(filePath) {
  return chalk.green(filePath);
}

/**
 * Format a count or number for display
 * @param {number} count - The number to format
 * @returns {string} - The formatted number
 */
export function formatCount(count) {
  return chalk.yellow(count.toString());
}

/**
 * Format a title for display
 * @param {string} title - The title to format
 * @returns {string} - The formatted title
 */
export function formatTitle(title) {
  return chalk.magenta.bold(title);
}

/**
 * Format a section heading
 * @param {string} heading - The heading text
 * @returns {string} - The formatted heading
 */
export function formatHeading(heading) {
  return `\n${chalk.white.bold.underline(heading)}\n`;
}

/**
 * Format an item in a list
 * @param {string} item - The item text
 * @param {number} index - The item index (optional)
 * @returns {string} - The formatted item
 */
export function formatListItem(item, index) {
  const prefix = index !== undefined ? chalk.cyan(`${index + 1}. `) : chalk.cyan('• ');
  return `${prefix}${item}`;
}