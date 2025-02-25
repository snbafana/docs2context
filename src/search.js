import * as DDG from 'duck-duck-scrape';
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
 * Search for documentation for a given project using DuckDuckGo Scrape
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
export async function searchForDocumentation(projectName) {
  const spinner = createSpinner(`Searching for ${projectName} documentation`);
  
  try {
    spinner.start();
    const searchQuery = `${projectName} docs`;
    
    logInfo(`Searching for "${searchQuery}" using duck-duck-scrape`);
    
    // Use duck-duck-scrape to search
    const searchResults = await DDG.search(searchQuery, {
      safeSearch: DDG.SafeSearchType.MODERATE
    });
    
    const results = [];
    
    if (searchResults && !searchResults.noResults && searchResults.results) {
      logInfo(`Found ${searchResults.results.length} results from DuckDuckGo`);

      // Process the results
      searchResults.results.forEach(result => {
        results.push({
          title: result.title,
          url: result.url,
          description: result.description || ''
        });
      });
      
      // If there's a "bang" suggestion in the results, use it too
      if (searchResults.results.some(r => r.bang)) {
        const bangSuggestion = searchResults.results.find(r => r.bang);
        
        if (bangSuggestion && bangSuggestion.bang.domain) {
          logInfo(`Found bang suggestion for ${bangSuggestion.bang.title} (${bangSuggestion.bang.domain})`);
          
          // Add the specific documentation site suggested by DuckDuckGo bangs
          if (!results.some(r => r.url === bangSuggestion.url)) {
            results.push({
              title: bangSuggestion.bang.title,
              url: bangSuggestion.url,
              description: `Official documentation via DuckDuckGo bang (${bangSuggestion.bang.prefix})`
            });
          }
        }
      }
      
      // Try searching for just the project name
      spinner.text = `Trying general search for ${projectName}`;
      const generalResults = await DDG.search(projectName, {
        safeSearch: DDG.SafeSearchType.MODERATE
      });
      
      if (generalResults && !generalResults.noResults && generalResults.results) {
        logInfo(`Found ${generalResults.results.length} results from general search`);
        
        generalResults.results.forEach(result => {
          results.push({
            title: result.title,
            url: result.url,
            description: result.description || ''
          });
        });
      }
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