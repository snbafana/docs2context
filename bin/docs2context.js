#!/usr/bin/env node

import { Command } from 'commander';
import { addDocumentation } from '../src/index.js';
import { displayHeader } from '../src/ui.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('docs2context')
  .description('CLI tool to scrape and aggregate documentation into a single markdown file')
  .version('0.1.0');

program
  .command('add')
  .description('Add documentation for a project')
  .argument('<project>', 'Project name to search for documentation')
  .option('-u, --url <url>', 'Direct URL to documentation')
  .option('-o, --output <path>', 'Output file path')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--disable-ai', 'Disable AI cleaning of content', false)
  .option('-c, --concurrency <number>', 'Number of concurrent operations', '10')
  .action((project, options) => {
    // Set logging level if verbose flag is provided
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    // Parse options for the scraper
    const scraperOptions = {
      disableAI: options.disableAi === true,
      concurrency: parseInt(options.concurrency, 10) || 10
    };
    
    addDocumentation(project, options.url, scraperOptions);
  });

// Add more commands as needed
program
  .command('version')
  .description('Display the current version')
  .action(() => {
    displayHeader();
    console.log(chalk.cyan(`Version: ${program.version()}`));
  });

program.parse(process.argv);

// Show help with nice formatting if no arguments provided
if (!process.argv.slice(2).length) {
  displayHeader();
  program.outputHelp();
}