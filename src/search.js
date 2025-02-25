import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Search for documentation for a given project
 * @param {string} projectName - Name of the project to search for
 * @returns {Promise<Array<{title: string, url: string}>>} - Search results
 */
export async function searchForDocumentation(projectName) {
  try {
    // Note: In a real implementation, this would use a proper search API
    // This is a simplified example using a search query
    const searchQuery = `${projectName} documentation`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    // This is a simplified implementation
    // In reality, we would need to handle Google's anti-scraping measures
    // or use a proper search API like Bing, DuckDuckGo, or a paid service
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // This selector would need to be updated based on Google's current HTML structure
    // In reality, we should use a more reliable search API
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      if (href && href.startsWith('http') && !href.includes('google.com')) {
        const title = $(element).text() || href;
        // Filter to likely documentation sites
        if (
          href.includes('docs.') || 
          href.includes('/docs') || 
          href.includes('/documentation') ||
          href.includes('developer.') ||
          href.includes('/api') ||
          title.toLowerCase().includes('documentation')
        ) {
          results.push({
            title,
            url: href
          });
        }
      }
    });
    
    // Remove duplicates and limit to 5 results
    const uniqueResults = Array.from(new Set(results.map(r => r.url)))
      .map(url => results.find(r => r.url === url))
      .slice(0, 5);
    
    return uniqueResults;
  } catch (error) {
    console.error('Error searching for documentation:', error);
    throw new Error('Failed to search for documentation');
  }
}

/**
 * Mock function for demonstration purposes
 * In a real implementation, this would be replaced with actual search logic
 */
export async function mockSearchForDocumentation(projectName) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return mock results based on project name
  const mockResults = {
    'react': [
      { title: 'React Documentation', url: 'https://reactjs.org/docs/getting-started.html' },
      { title: 'React API Reference', url: 'https://reactjs.org/docs/react-api.html' },
      { title: 'Create React App Documentation', url: 'https://create-react-app.dev/docs/getting-started' }
    ],
    'express': [
      { title: 'Express - Node.js web application framework', url: 'https://expressjs.com/' },
      { title: 'Express API Documentation', url: 'https://expressjs.com/en/4x/api.html' },
      { title: 'Express Guide', url: 'https://expressjs.com/en/guide/routing.html' }
    ],
    'default': [
      { title: `${projectName} Documentation`, url: `https://example.com/${projectName}/docs` },
      { title: `${projectName} API Reference`, url: `https://example.com/${projectName}/api` },
      { title: `${projectName} Getting Started`, url: `https://example.com/${projectName}/getting-started` }
    ]
  };
  
  return mockResults[projectName.toLowerCase()] || mockResults.default;
}