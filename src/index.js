import axios from 'axios';
import * as cheerio from 'cheerio';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { fileURLToPath } from 'url';
import { Command } from 'commander';

import { searchForDocumentation } from './search.js';
import { scrapeContent } from './scraper.js';
import { 
  logger, 
  logInfo, 
  logSuccess, 
  logWarning, 
  logError 
} from './logger.js';
import {
  displayHeader,
  createSpinner,
  displayInfo,
  displaySuccess,
  displayWarning,
  displayError,
  formatUrl,
  formatFilePath,
  formatTitle,
  formatHeading
} from './ui.js';

/**
 * Main function to add documentation for a project
 * @param {string} projectName - Name of the project to document
 * @param {string} [directUrl] - Optional direct URL to documentation
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.disableAI] - Whether to disable AI cleaning
 * @param {number} [options.concurrency] - Number of concurrent operations
 */
export async function addDocumentation(projectName, directUrl, options = {}) {
  try {
    // Display welcome header
    displayHeader();
    console.log(directUrl)
    
    logInfo(`Starting documentation process for project: ${projectName}`);
    if (directUrl) {
      logInfo(`Using direct URL: ${directUrl}`);
    }
    
    let documentationUrl = directUrl;
    
    // If no direct URL provided, search for documentation
    if (!documentationUrl) {
      try {
        // Search functionality is handled in search.js with its own spinner
        const searchResults = await searchForDocumentation(projectName);
        
        if (searchResults.length === 0) {
          displayWarning(`No documentation found for ${formatTitle(projectName)}. Try providing a direct URL.`);
          logWarning(`No documentation found for project: ${projectName}`);
          return;
        }
        
        displayInfo(formatHeading('Please select the documentation source'));
        
        // Let user select the correct documentation
        const { selectedUrl } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedUrl',
            message: 'Choose the most appropriate documentation source:',
            loop: false,
            pageSize: 10,
            choices: searchResults.map(result => ({
              name: `${result.title} (${formatUrl(result.url)})`,
              value: result.url
            }))
          }
        ]);
        
        documentationUrl = selectedUrl;
        logInfo(`User selected documentation URL: ${documentationUrl}`);
      } catch (error) {
        displayError(`Search failed: ${error.message}`);
        logError('Error searching for documentation', error);
        return;
      }
    }
    
    // Confirm the URL with the user
    displayInfo(formatHeading('Confirmation'));
    
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Will scrape documentation from: ${formatUrl(documentationUrl)}\nContinue with this source?`,
        default: true
      }
    ]);
    
    if (!confirmed) {
      displayInfo('Operation cancelled by user.');
      logInfo('Operation cancelled by user.');
      return;
    }
    
    // Start scraping process
    try {
      // Pass options to the scraper
      // Scraping functionality is handled in scraper.js with its own spinner
      const content = await scrapeContent(documentationUrl, options);
      
      if (options.disableAI) {
        logInfo('AI cleaning was disabled for this scrape');
      }
      
      // Create output directory if it doesn't exist
      try {
        await fs.mkdir('output', { recursive: true });
      } catch (err) {
        logWarning(`Failed to create output directory: ${err.message}`);
      }
      
      // Create file name based on project name
      const fileName = `output/${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-docs.md`;
      const spinner = createSpinner(`Saving documentation to ${formatFilePath(fileName)}...`);
      spinner.start();
      
      await fs.writeFile(fileName, content);
      
      spinner.succeed(`Documentation saved to ${formatFilePath(fileName)}`);
      logSuccess(`Documentation successfully saved to ${fileName}`);
      
      // Show summary
      displayInfo(formatHeading('Summary'));
      displaySuccess(`Project: ${formatTitle(projectName)}`);
      displaySuccess(`Source: ${formatUrl(documentationUrl)}`);
      displaySuccess(`Output: ${formatFilePath(fileName)}`);
      displaySuccess(`Content size: ${formatFilePath((content.length / 1024).toFixed(2) + ' KB')}`);
      
    } catch (error) {
      displayError(`Scraping failed: ${error.message}`);
      logError('Error scraping documentation', error);
    }
  } catch (error) {
    displayError(`An unexpected error occurred: ${error.message}`);
    logError('An unexpected error occurred', error);
  }
}