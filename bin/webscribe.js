#!/usr/bin/env node

import { Command } from 'commander';
import { addDocumentation } from '../src/index.js';

const program = new Command();

program
  .name('webscribe')
  .description('CLI tool to scrape and aggregate documentation into a single markdown file')
  .version('0.1.0');

program
  .command('add')
  .description('Add documentation for a project')
  .argument('<project>', 'Project name to search for documentation')
  .option('-u, --url <url>', 'Direct URL to documentation')
  .action((project, options) => {
    addDocumentation(project, options.url);
  });

program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}