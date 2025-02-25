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
  const baseUrl = new URL(startUrl).origin;
  const baseDomain = new URL(startUrl).hostname;
  
  displayInfo(`Starting documentation scrape from ${formatUrl(startUrl)}`);
  displayInfo(`Base URL: ${formatUrl(baseUrl)}`);
  displayInfo(`Base Domain: ${baseDomain}`);
  
  logInfo(`Starting documentation scrape from ${startUrl}`);
  logInfo(`Using base URL: ${baseUrl}`);
  logInfo(`Using base domain: ${baseDomain}`);
  
  // Multi-level crawling
  const crawler = createSpinner('Crawling website for documentation pages...');
  crawler.start();
  
  // Set to track visited URLs to avoid duplicates
  const allUrls = new Set();
  allUrls.add(startUrl);
  
  // Level 1: Get links from start URL
  logInfo('Starting Level 1 crawl (base page)');
  const level1Links = await extractLinksFromUrl(startUrl, baseDomain);
  level1Links.forEach(url => allUrls.add(url));
  
  crawler.text = `Found ${formatCount(level1Links.length)} links from base page`;
  logInfo(`Level 1 crawl complete, found ${level1Links.length} links`);
  
  // Level 2: Get links from each of the level 1 pages
  logInfo('Starting Level 2 crawl');
  crawler.text = 'Crawling second level pages...';
  
  const level2Links = new Set();
  let processedCount = 0;
  
  // Process in batches of 5 to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < level1Links.length; i += batchSize) {
    const batch = level1Links.slice(i, i + batchSize);
    const batchPromises = batch.map(url => extractLinksFromUrl(url, baseDomain));
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      processedCount++;
      crawler.text = `Crawling second level... (${formatCount(processedCount)}/${level1Links.length} pages)`;
      
      if (result.status === 'fulfilled') {
        result.value.forEach(url => {
          if (!allUrls.has(url)) {
            level2Links.add(url);
            allUrls.add(url);
          }
        });
      }
    });
  }
  
  logInfo(`Level 2 crawl complete, found ${level2Links.size} new links`);
  crawler.text = `Found ${formatCount(level2Links.size)} links from second level pages`;
  
  // Level 3: Get links from each of the level 2 pages
  logInfo('Starting Level 3 crawl');
  crawler.text = 'Crawling third level pages...';
  
  const level3Links = new Set();
  processedCount = 0;
  
  const level2Array = Array.from(level2Links);
  for (let i = 0; i < level2Array.length; i += batchSize) {
    const batch = level2Array.slice(i, i + batchSize);
    const batchPromises = batch.map(url => extractLinksFromUrl(url, baseDomain));
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      processedCount++;
      crawler.text = `Crawling third level... (${formatCount(processedCount)}/${level2Links.size} pages)`;
      
      if (result.status === 'fulfilled') {
        result.value.forEach(url => {
          if (!allUrls.has(url)) {
            level3Links.add(url);
            allUrls.add(url);
          }
        });
      }
      // If there was a failure to extract links, just move on - nothing to do here
    });
  }
  
  logInfo(`Level 3 crawl complete, found ${level3Links.size} new links`);
  
  // Level 4: Get links from each of the level 3 pages
  logInfo('Starting Level 4 crawl');
  crawler.text = 'Crawling fourth level pages...';
  
  const level4Links = new Set();
  processedCount = 0;
  
  const level3Array = Array.from(level3Links);
  for (let i = 0; i < level3Array.length; i += batchSize) {
    const batch = level3Array.slice(i, i + batchSize);
    const batchPromises = batch.map(url => extractLinksFromUrl(url, baseDomain));
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      processedCount++;
      crawler.text = `Crawling fourth level... (${formatCount(processedCount)}/${level3Links.size} pages)`;
      
      if (result.status === 'fulfilled') {
        result.value.forEach(url => {
          if (!allUrls.has(url)) {
            level4Links.add(url);
            allUrls.add(url);
          }
        });
      }
      // If there was a failure to extract links, just move on
    });
  }
  
  logInfo(`Level 4 crawl complete, found ${level4Links.size} new links`);
  
  // Combine all unique URLs
  const allUrlsArray = Array.from(allUrls);
  
  // Filter URLs to only include likely documentation pages
  const docUrls = allUrlsArray.filter(url => isLikelyDocPage(url));
  
  crawler.succeed(`Found ${formatCount(docUrls.length)} documentation pages across 4 levels`);
  logSuccess(`Discovered ${docUrls.length} documentation pages through crawling`);
  
  // Now scrape content from all the discovered URLs
  const spinner = createSpinner('Scraping documentation content...');
  spinner.start();
  
  const maxPages = 200; // Limit to 200 pages for safety
  const pagesToProcess = docUrls.slice(0, maxPages);
  
  const pages = [];
  let pageCount = 0;
  
  // Process pages in batches
  for (let i = 0; i < pagesToProcess.length; i += batchSize) {
    const batch = pagesToProcess.slice(i, i + batchSize);
    const batchPromises = batch.map(url => scrapePageContent(url));
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      pageCount++;
      spinner.text = `Scraping content... (${formatCount(pageCount)}/${pagesToProcess.length} pages)`;
      
      if (result.status === 'fulfilled' && result.value) {
        pages.push(result.value);
        logSuccess(`Successfully scraped content from ${batch[index]}`);
      } else {
        logWarning(`Failed to scrape content from ${batch[index]}`);
      }
    });
  }
  
  if (pages.length === 0) {
    spinner.fail('No documentation pages were successfully scraped');
    logError('Failed to scrape any documentation pages');
    return "No documentation content could be scraped.";
  }
  
  spinner.succeed(`Scraped content from ${formatCount(pages.length)} documentation pages`);
  logSuccess(`Successfully scraped content from ${pages.length} documentation pages`);
  
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
  
  /**
   * Extract links from a URL that match the base domain
   * @param {string} url - URL to extract links from
   * @param {string} baseDomain - Domain to filter links by
   * @returns {Promise<string[]>} - Array of discovered URLs
   */
  async function extractLinksFromUrl(url, baseDomain) {
    try {
      // Skip URLs that are likely to be binary files or assets
      if (url.match(/\.(pdf|zip|jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i)) {
        return [];
      }
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status < 400; // Only consider responses with status code < 400 as successful
        }
      });
      
      // If we got here, the response was successful
      const contentType = response.headers['content-type'] || '';
      
      // Skip binary content
      if (!contentType.includes('text/html') && 
          !contentType.includes('application/xhtml+xml') && 
          !contentType.includes('text/plain')) {
        return [];
      }
      
      const $ = cheerio.load(response.data);
      const links = new Set();
      
      $('a').each((i, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Resolve relative URLs
        let resolvedUrl;
        try {
          resolvedUrl = new URL(href, url).href;
        } catch (e) {
          return;
        }
        
        // Check if URL is from the same domain and not a file/resource
        const urlObj = new URL(resolvedUrl);
        if (
          urlObj.hostname === baseDomain && 
          !resolvedUrl.includes('#') && // Skip anchor links
          !resolvedUrl.endsWith('.pdf') && // Skip PDFs
          !resolvedUrl.endsWith('.zip') && // Skip downloads
          !resolvedUrl.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i) && // Skip media/assets
          !resolvedUrl.includes('?') // Skip URLs with query parameters to avoid crawling the same content with different params
        ) {
          links.add(resolvedUrl);
        }
      });
      
      return Array.from(links);
    } catch (error) {
      // Just log the error and return an empty array - we'll continue with other URLs
      logWarning(`Failed to extract links from ${url}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Scrape content from a single page
   * @param {string} url - URL to scrape
   * @returns {Promise<Object|null>} - Page object with title and content, or null if failed
   */
  async function scrapePageContent(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });
      
      const $ = cheerio.load(response.data);
      const title = $('title').text().trim() || url;
      
      // Extract content from main documentation area
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
          logDebug(`Found content in ${url} using selector: ${selector}`);
          mainContent = content;
          break;
        }
      }
      
      if (!mainContent) {
        return null;
      }
      
      // Convert HTML to Markdown
      const markdown = nhm.translate(mainContent);
      
      return {
        url: url,
        title: title,
        content: `# ${title}\n\nSource: ${url}\n\n${markdown}`
      };
    } catch (error) {
      return null;
    }
  }
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