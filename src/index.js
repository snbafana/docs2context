import axios from 'axios';
import * as cheerio from 'cheerio';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { fileURLToPath } from 'url';

import { searchForDocumentation } from './search.js';
import { scrapeContent } from './scraper.js';

/**
 * Main function to add documentation for a project
 * @param {string} projectName - Name of the project to document
 * @param {string} [directUrl] - Optional direct URL to documentation
 */
export async function addDocumentation(projectName, directUrl) {
  try {
    let documentationUrl = directUrl;
    
    // If no direct URL provided, search for documentation
    if (!documentationUrl) {
      const spinner = ora('Searching for documentation...').start();
      try {
        const searchResults = await searchForDocumentation(projectName);
        spinner.succeed('Search complete');
        
        if (searchResults.length === 0) {
          console.log('No documentation found for this project. Try providing a direct URL.');
          return;
        }
        
        // Let user select the correct documentation
        const { selectedUrl } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedUrl',
            message: 'Please select the correct documentation:',
            choices: searchResults.map(result => ({
              name: `${result.title} (${result.url})`,
              value: result.url
            }))
          }
        ]);
        
        documentationUrl = selectedUrl;
      } catch (error) {
        spinner.fail('Search failed');
        console.error('Error searching for documentation:', error.message);
        return;
      }
    }
    
    // Confirm the URL with the user
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Will scrape documentation from: ${documentationUrl}\nContinue?`,
        default: true
      }
    ]);
    
    if (!confirmed) {
      console.log('Operation cancelled.');
      return;
    }
    
    // Start scraping process
    const spinner = ora('Scraping documentation...').start();
    try {
      const content = await scrapeContent(documentationUrl);
      
      // Create file name based on project name
      const fileName = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-docs.md`;
      await fs.writeFile(fileName, content);
      
      spinner.succeed(`Documentation saved to ${fileName}`);
    } catch (error) {
      spinner.fail('Scraping failed');
      console.error('Error scraping documentation:', error.message);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
  }
}