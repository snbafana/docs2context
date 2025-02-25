import axios from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { URL } from 'url';
import { 
  logger, 
  logInfo, 
  logSuccess, 
  logWarning, 
  logError, 
  logDebug 
} from './logger.js';
import {
  createSpinner,
  displayInfo,
  formatUrl,
  formatCount,
  formatTitle,
  formatHeading,
  formatListItem
} from './ui.js';

// Initialize markdown converter
const nhm = new NodeHtmlMarkdown();

/**
 * Scrape content from documentation URL and its linked pages
 * @param {string} startUrl - URL to start scraping from
 * @returns {Promise<string>} - Combined markdown content
 */
export async function scrapeContent(startUrl) {
  const visited = new Set();
  const queue = [startUrl];
  const baseUrl = new URL(startUrl).origin;
  const pages = [];
  
  displayInfo(`Starting documentation scrape from ${formatUrl(startUrl)}`);
  displayInfo(`Base URL: ${formatUrl(baseUrl)}`);
  
  logInfo(`Starting documentation scrape from ${startUrl}`);
  logInfo(`Using base URL: ${baseUrl}`);
  
  const spinner = createSpinner('Discovering documentation pages...');
  spinner.start();
  
  let pageCount = 0;
  const maxPages = 50; // Limit to 50 pages for safety
  
  while (queue.length > 0 && pageCount < maxPages) {
    const currentUrl = queue.shift();
    
    if (visited.has(currentUrl)) {
      continue;
    }
    
    visited.add(currentUrl);
    pageCount++;
    
    spinner.text = `Discovering documentation pages... (${formatCount(pageCount)} found)`;
    logInfo(`Processing page ${pageCount}/${maxPages}: ${currentUrl}`);
    
    try {
      const response = await axios.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });
      
      const $ = cheerio.load(response.data);
      const title = $('title').text().trim() || currentUrl;
      
      logInfo(`Page title: "${title}"`);
      
      // Extract content from main documentation area
      // This would need to be customized for different documentation sites
      const contentSelectors = [
        'main',
        '#main-content',
        '.main-content',
        '.documentation',
        '.content',
        'article',
        '.markdown-body',
        '#content',
        '.docs-content',
        '.docs',
        'body'
      ];
      
      let mainContent = null;
      for (const selector of contentSelectors) {
        const content = $(selector).html();
        if (content) {
          logDebug(`Found content using selector: ${selector}`);
          mainContent = content;
          break;
        }
      }
      
      if (!mainContent) {
        logWarning(`No content found for ${currentUrl}`);
        continue;
      }
      
      // Convert HTML to Markdown
      const markdown = nhm.translate(mainContent);
      
      pages.push({
        url: currentUrl,
        title: title,
        content: `# ${title}\n\nSource: ${currentUrl}\n\n${markdown}`
      });
      
      logSuccess(`Successfully scraped content from ${currentUrl}`);
      
      // Find links to other documentation pages
      let newLinksFound = 0;
      $('a').each((i, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Resolve relative URLs
        let resolvedUrl;
        try {
          resolvedUrl = new URL(href, currentUrl).href;
        } catch (e) {
          return;
        }
        
        // Only follow links from the same domain and that look like documentation
        if (
          resolvedUrl.startsWith(baseUrl) && 
          !visited.has(resolvedUrl) && 
          !queue.includes(resolvedUrl) &&
          !resolvedUrl.includes('#') && // Skip anchor links
          !resolvedUrl.endsWith('.pdf') && // Skip PDFs
          !resolvedUrl.endsWith('.zip') && // Skip downloads
          !resolvedUrl.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/i) && // Skip media/assets
          isLikelyDocPage(resolvedUrl)
        ) {
          queue.push(resolvedUrl);
          newLinksFound++;
        }
      });
      
      logDebug(`Found ${newLinksFound} new links to follow from ${currentUrl}`);
      
    } catch (error) {
      spinner.text = `Error processing ${formatUrl(currentUrl)}`;
      logWarning(`Failed to fetch ${currentUrl}: ${error.message}`);
    }
  }
  
  if (pages.length > 0) {
    spinner.succeed(`Discovered ${formatCount(pages.length)} documentation pages`);
    logSuccess(`Scraped content from ${pages.length} documentation pages`);
  } else {
    spinner.fail('No documentation pages were successfully scraped');
    logError('Failed to scrape any documentation pages');
  }
  
  // Sort pages to try to get a logical order
  spinner.text = 'Organizing content...';
  spinner.start();
  
  pages.sort((a, b) => {
    // Check if URL contains "intro", "getting-started", etc.
    const introTerms = ['intro', 'getting-started', 'overview', 'index', 'readme', 'home', 'quickstart'];
    const aHasIntro = introTerms.some(term => a.url.toLowerCase().includes(term));
    const bHasIntro = introTerms.some(term => b.url.toLowerCase().includes(term));
    
    if (aHasIntro && !bHasIntro) return -1;
    if (!aHasIntro && bHasIntro) return 1;
    
    // Otherwise sort alphabetically by title
    return a.title.localeCompare(b.title);
  });
  
  logInfo('Sorted pages in logical order with introductory content first');
  
  // Create table of contents
  spinner.text = 'Generating table of contents...';
  
  let toc = formatHeading('Table of Contents');
  pages.forEach((page, index) => {
    const anchor = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    toc += formatListItem(`[${page.title}](#${anchor})`, index) + '\n';
  });
  
  logInfo('Generated table of contents with links to all sections');
  
  // Combine all content
  spinner.text = 'Compiling final documentation...';
  
  const combinedContent = [
    `# Documentation\n\nAutomatically aggregated documentation from ${startUrl}\n\n`,
    toc,
    ...pages.map(page => page.content)
  ].join('\n\n---\n\n');
  
  spinner.succeed('Documentation compilation complete');
  logSuccess(`Successfully compiled documentation with ${pages.length} pages and ${combinedContent.length} characters`);
  
  return combinedContent;
}

/**
 * Determine if a URL is likely to be a documentation page
 * @param {string} url - URL to check
 * @returns {boolean} - Whether URL is likely a documentation page
 */
function isLikelyDocPage(url) {
  const docPatterns = [
    '/docs/',
    '/documentation/',
    '/guide/',
    '/tutorial/',
    '/reference/',
    '/api/',
    '/manual/',
    '/learn/',
    '/examples/',
    '/getting-started',
    '/quickstart',
    '/introduction',
    '/overview',
    '/handbook',
    '/concepts',
    '/usage',
    '/faq'
  ];
  
  // Exclude patterns that are likely not documentation pages
  const excludePatterns = [
    '/blog/',
    '/news/',
    '/download/',
    '/releases/',
    '/changelog/',
    '/community/',
    '/forum/',
    '/contact/',
    '/pricing/',
    '/team/',
    '/about/',
    '/support/',
    '/legal/',
    '/terms/',
    '/privacy/'
  ];
  
  if (excludePatterns.some(pattern => url.includes(pattern))) {
    return false;
  }
  
  return docPatterns.some(pattern => url.includes(pattern)) ||
         url.endsWith('.html') || 
         url.endsWith('.md') ||
         !url.includes('.');
}