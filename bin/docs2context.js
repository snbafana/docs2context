#!/usr/bin/env node

import { Command } from 'commander';
import { addDocumentation } from '../src/index.js';
import { displayHeader } from '../src/ui.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('docs2context')
  .description('CLI tool to scrape and aggregate documentation into a single markdown file')
  .version('0.1.0')
  .argument('<project>', 'Project name to search for documentation')
  .option('-u, --url <url>', 'Direct URL to documentation')
  .option('-o, --output <path>', 'Output file path')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--disable-ai', 'Disable AI cleaning of content', false)
  .option('-c, --concurrency <number>', 'Number of concurrent operations', '10')
  .action((project, options) => {
    if (options.verbose) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    const scraperOptions = {
      disableAI: options.disableAi === true,
      concurrency: parseInt(options.concurrency, 10) || 10
    };
    
    addDocumentation(project, options.url, scraperOptions);
  });

program.parse();

if (!process.argv.slice(2).length) {
  displayHeader();
  program.outputHelp();
}