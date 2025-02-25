import axios from 'axios';

/**
 * Search for documentation for a given project using DuckDuckGo API
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
export async function searchForDocumentation(projectName) {
  try {
    const searchQuery = `${projectName} documentation`;
    
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
      response.data.Results.forEach(result => {
        results.push({
          title: result.Text,
          url: result.FirstURL
        });
      });
    }
    
    // Also check the related topics for more results
    if (response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
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
      // Fallback using a different approach
      const fallbackResults = await fallbackSearch(projectName);
      results.push(...fallbackResults);
    }
    
    // Return top 10 unique results
    const uniqueResults = Array.from(new Set(results.map(r => r.url)))
      .map(url => results.find(r => r.url === url))
      .filter(r => r && isLikelyDocumentation(r.url, r.title))
      .slice(0, 10);
    
    return uniqueResults;
  } catch (error) {
    console.error('Error searching for documentation:', error);
    // Fallback in case of error
    return fallbackSearch(projectName);
  }
}

/**
 * Fallback search method that doesn't rely on the DuckDuckGo API
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
async function fallbackSearch(projectName) {
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
    
    const results = [];
    
    // Check if each URL exists
    const checkPromises = commonDocsPatterns.map(async url => {
      try {
        const response = await axios.head(url, { 
          timeout: 2000,
          validateStatus: status => status < 400
        });
        if (response.status < 400) {
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
    
    return results;
  } catch (error) {
    console.error('Error in fallback search:', error);
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