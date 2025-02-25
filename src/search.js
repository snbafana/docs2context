import axios from 'axios';
import { 
  logger, 
  logInfo, 
  logSuccess, 
  logWarning, 
  logError
} from './logger.js';
import {
  createSpinner,
  formatUrl,
  formatCount
} from './ui.js';

/**
 * Search for documentation for a given project using DuckDuckGo API
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
export async function searchForDocumentation(projectName) {
  const spinner = createSpinner(`Searching for ${projectName} documentation`);
  
  try {
    spinner.start();
    const searchQuery = `${projectName} documentation`;
    
    logInfo(`Searching for "${searchQuery}" using DuckDuckGo API`);
    
    // DuckDuckGo search API endpoint
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: searchQuery,
        format: 'json',
        no_html: 1,
        skip_disambig: 1
      }
    });
    
    const results = [];
    
    // Extract results from DuckDuckGo response
    if (response.data.Results && response.data.Results.length > 0) {
      logInfo(`Found ${response.data.Results.length} direct results from DuckDuckGo`);
      response.data.Results.forEach(result => {
        results.push({
          title: result.Text,
          url: result.FirstURL
        });
      });
    }
    
    // Also check the related topics for more results
    if (response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
      logInfo(`Found ${response.data.RelatedTopics.length} related topics from DuckDuckGo`);
      response.data.RelatedTopics.forEach(topic => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text,
            url: topic.FirstURL
          });
        }
      });
    }
    
    // If DuckDuckGo API didn't return enough results, fallback to a HTTP request
    if (results.length < 5) {
      logInfo(`Not enough results (${results.length}), trying fallback search method`);
      spinner.text = 'Not enough results, trying fallback search...';
      
      // Fallback using a different approach
      const fallbackResults = await fallbackSearch(projectName);
      results.push(...fallbackResults);
    }
    
    // Return top 10 unique results
    const uniqueResults = Array.from(new Set(results.map(r => r.url)))
      .map(url => results.find(r => r.url === url))
      .filter(r => r && isLikelyDocumentation(r.url, r.title))
      .slice(0, 10);
    
    if (uniqueResults.length > 0) {
      spinner.succeed(`Found ${formatCount(uniqueResults.length)} documentation resources for ${projectName}`);
      logSuccess(`Search found ${uniqueResults.length} potential documentation resources`);
      
      // Log all found URLs for debugging
      uniqueResults.forEach((result, index) => {
        logInfo(`Result ${index + 1}: ${result.title} - ${result.url}`);
      });
    } else {
      spinner.warn(`No documentation found for ${projectName}`);
      logWarning(`No documentation found for ${projectName}`);
    }
    
    return uniqueResults;
  } catch (error) {
    spinner.fail(`Search failed for ${projectName}`);
    logError('Error searching for documentation', error);
    
    // Fallback in case of error
    logInfo('Attempting fallback search after error');
    return fallbackSearch(projectName);
  }
}

/**
 * Fallback search method that doesn't rely on the DuckDuckGo API
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
async function fallbackSearch(projectName) {
  const spinner = createSpinner('Trying common documentation URL patterns');
  spinner.start();
  
  try {
    // Common documentation URLs patterns
    const commonDocsPatterns = [
      `https://docs.${projectName}.com`,
      `https://docs.${projectName}.org`,
      `https://docs.${projectName}.io`,
      `https://${projectName}.dev/docs`,
      `https://${projectName}.org/docs`,
      `https://${projectName}.io/docs`,
      `https://${projectName}.com/docs`,
      `https://${projectName}.js.org`,
      `https://developer.${projectName}.com`,
      `https://${projectName}.readthedocs.io`
    ];
    
    logInfo(`Checking ${commonDocsPatterns.length} common documentation URL patterns`);
    const results = [];
    
    // Check if each URL exists
    const checkPromises = commonDocsPatterns.map(async url => {
      try {
        spinner.text = `Checking ${formatUrl(url)}`;
        const response = await axios.head(url, { 
          timeout: 2000,
          validateStatus: status => status < 400
        });
        if (response.status < 400) {
          logInfo(`Found valid documentation URL: ${url}`);
          results.push({
            title: `${projectName} Documentation`,
            url
          });
        }
      } catch (error) {
        // URL doesn't exist or is not accessible, ignore
      }
    });
    
    await Promise.all(checkPromises);
    
    if (results.length > 0) {
      spinner.succeed(`Found ${formatCount(results.length)} documentation URLs through fallback search`);
      logSuccess(`Fallback search found ${results.length} documentation URLs`);
    } else {
      spinner.warn('No documentation found through fallback search');
      logWarning('No documentation found through fallback search');
    }
    
    return results;
  } catch (error) {
    spinner.fail('Fallback search failed');
    logError('Error in fallback search', error);
    return [];
  }
}

/**
 * Check if a URL is likely to be documentation
 * @param {string} url - URL to check
 * @param {string} title - Title of the page
 * @returns {boolean} - Whether URL is likely documentation
 */
function isLikelyDocumentation(url, title) {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // URL patterns that suggest documentation
  const docUrlPatterns = [
    '/docs', 
    '/documentation', 
    '/api', 
    '/guide',
    '/manual',
    '/reference',
    '/tutorial',
    'docs.',
    'developer.'
  ];
  
  // Title terms that suggest documentation
  const docTitleTerms = [
    'documentation',
    'docs',
    'guide',
    'manual',
    'api',
    'reference',
    'tutorial',
    'getting started'
  ];
  
  return docUrlPatterns.some(pattern => lowerUrl.includes(pattern)) ||
         docTitleTerms.some(term => lowerTitle.includes(term));
}