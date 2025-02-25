import axios from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { URL } from 'url';
import OpenAI from 'openai';
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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Cleans and formats markdown content using OpenAI GPT-4o-mini
 * @param {string} content - Raw markdown content to clean
 * @param {string} title - Title of the page
 * @param {string} url - URL of the page
 * @returns {Promise<string>} - Cleaned and formatted markdown content
 */
async function cleanMarkdownWithAI(content, title, url) {
  try {
    // Create system message with instructions
    const systemMessage = `You are a documentation formatter that specializes in cleaning up scraped web content. 
Your task is to improve the quality and readability of scraped documentation.`;

    // Create user message with content to clean
    const userMessage = `
I have scraped documentation content from a webpage and converted it to markdown. Please clean and format this content by:
1. Removing any navigation elements, footers, or other non-documentation content
2. Fixing any formatting issues or broken markdown syntax
3. Ensuring proper heading hierarchy
4. Making the content more readable and well-formatted
5. Preserving all technical information and code examples
6. Keeping only the essential documentation content

The content is from: ${url}
Title: ${title}

Here's the content to clean:

${content}

Please return ONLY the cleaned markdown with no additional explanation or commentary. Maintain all technical accuracy.
`;

    // Send the request to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    // Extract and return the cleaned content
    const cleanedContent = completion.choices[0].message.content;
    
    // If we got back an empty response or very short response, fall back to the original
    if (!cleanedContent || cleanedContent.length < 100) {
      logWarning(`AI cleaning returned too short content for ${url}, using original`);
      return content;
    }
    
    logSuccess(`Successfully cleaned content from ${url} using GPT-4o-mini`);
    return cleanedContent;
  } catch (error) {
    // If there's any error with the AI, return the original content
    logWarning(`Error cleaning content with GPT-4o-mini for ${url}: ${error.message}`);
    return content;
  }
}

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
  
  // Create spinner for recursive crawling
  const crawler = createSpinner('Crawling website for documentation pages...');
  crawler.start();
  
  // Set to track all discovered URLs (both visited and to be visited)
  const discoveredUrls = new Set();
  // Set to track visited URLs
  const visitedUrls = new Set();
  // Queue of URLs to visit next
  const urlQueue = [startUrl];
  
  // Add start URL to discovered set
  discoveredUrls.add(startUrl);
  
  // Counter for discovered docs pages
  let docPagesCount = 0;
  // Max depth for crawling
  const maxDepth = 4;
  // Map to track URL depth
  const urlDepth = new Map();
  urlDepth.set(startUrl, 1);
  
  // Batch size for concurrent requests
  const batchSize = 5;
  
  // Loop until queue is empty
  while (urlQueue.length > 0) {
    // Get next batch of URLs to process
    const currentBatch = urlQueue.splice(0, batchSize);
    
    // Process batch in parallel
    const batchPromises = currentBatch.map(url => {
      // Mark as visited before processing to prevent duplicate processing
      visitedUrls.add(url);
      
      // Get current depth
      const depth = urlDepth.get(url) || 1;
      
      // Skip if we've reached max depth
      if (depth > maxDepth) return Promise.resolve({ url, links: [] });
      
      // Update spinner
      crawler.text = `Crawling level ${depth}... (${formatCount(visitedUrls.size)} visited, ${formatCount(discoveredUrls.size)} discovered)`;
      
      // Extract links from URL and make sure we always return an array
      return extractLinksFromUrl(url, baseDomain)
        .then(links => {
          // Ensure links is an array
          const linksArray = Array.isArray(links) ? links : [];
          return { url, links: linksArray };
        })
        .catch(error => {
          logWarning(`Failed to extract links from ${url}: ${error.message}`);
          return { url, links: [] };
        });
    });
    
    // Wait for all requests to complete
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process results and add new URLs to queue
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { url, links } = result.value;
        
        // Make sure links is always an array, even if it's somehow undefined or null
        const linksArray = Array.isArray(links) ? links : [];
        
        const currentDepth = urlDepth.get(url) || 1;
        const nextDepth = currentDepth + 1;
        
        // For each link found
        for (const link of linksArray) {
          // If we haven't discovered this URL yet
          if (!discoveredUrls.has(link)) {
            // Add to discovered set
            discoveredUrls.add(link);
            // Add to queue
            urlQueue.push(link);
            // Set depth
            urlDepth.set(link, nextDepth);
            
            // If it's likely a documentation page, increment counter
            if (isLikelyDocPage(link)) {
              docPagesCount++;
            }
          }
        }
      } else if (result.status === 'rejected') {
        // Log any errors but continue with other URLs
        logWarning(`A batch crawl operation failed: ${result.reason}`);
      }
    }
    
    // Log progress
    logInfo(`Crawl progress: ${visitedUrls.size} URLs visited, ${urlQueue.length} URLs in queue`);
  }
  
  // Log completion
  crawler.succeed(`Recursive crawl complete. Visited ${formatCount(visitedUrls.size)} URLs, discovered ${formatCount(discoveredUrls.size)} URLs`);
  logSuccess(`Found ${docPagesCount} likely documentation pages`);
  
  // Get all URLs we've discovered
  const allUrlsArray = Array.from(discoveredUrls);
  const uniqueUrlsArray = [...new Set(allUrlsArray)];
  
  // Filter URLs to only include likely documentation pages
  const docUrls = uniqueUrlsArray.filter(url => isLikelyDocPage(url));
  
  crawler.succeed(`Found ${formatCount(docUrls.length)} documentation pages across 4 levels`);
  logSuccess(`Discovered ${docUrls.length} documentation pages through crawling`);
  
  // Now scrape content from all the discovered URLs
  const spinner = createSpinner('Scraping documentation content...');
  spinner.start();
  
  const maxPages = 500; // Limit to 500 pages for safety
  const pagesToProcess = docUrls.slice(0, maxPages);
  
  const pages = [];
  let pageCount = 0;
  
  // Process pages in batches
  for (let i = 0; i < pagesToProcess.length; i += batchSize) {
    const batch = pagesToProcess.slice(i, i + batchSize);
    
    // Step 1: Scrape content from each page in the batch
    const batchPromises = batch.map(url => scrapePageContent(url));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Array to hold successfully scraped page content from this batch
    const batchPages = [];
    
    // Process scraping results
    batchResults.forEach((result, index) => {
      pageCount++;
      spinner.text = `Scraping content... (${formatCount(pageCount)}/${pagesToProcess.length} pages)`;
      
      if (result.status === 'fulfilled' && result.value) {
        batchPages.push(result.value);
        logSuccess(`Successfully scraped content from ${batch[index]}`);
      } else {
        logWarning(`Failed to scrape content from ${batch[index]}`);
      }
    });
    
    // Step 2: Clean each scraped page with AI
    if (batchPages.length > 0) {
      spinner.text = `Cleaning batch of ${batchPages.length} pages with GPT-4o-mini...`;
      
      // Process each page with AI in parallel
      const cleaningPromises = batchPages.map(page => 
        cleanMarkdownWithAI(page.content, page.title, page.url)
          .then(cleanedContent => {
            // Return a new object with cleaned content
            return {
              ...page,
              content: cleanedContent
            };
          })
      );
      
      // Wait for all AI cleaning to complete
      const cleanedResults = await Promise.allSettled(cleaningPromises);
      
      // Process cleaning results
      cleanedResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          // Add the cleaned page to the final pages array
          pages.push(result.value);
          logSuccess(`AI cleaned content for ${batchPages[index].url}`);
        } else {
          // If AI cleaning failed, add the original page
          pages.push(batchPages[index]);
          logWarning(`AI cleaning failed for ${batchPages[index].url}: ${result.reason}`);
        }
      });
    }
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
      // Skip URLs that are likely to be binary files or assets
      if (url.match(/\.(pdf|zip|jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot)$/i)) {
        return null;
      }
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000, // Increased timeout to 15 seconds
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
        return null;
      }
      
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
        '.document',
        '.doc-content',
        '.readme',
        '.page-content',
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
      
      // Clean up the content before converting to markdown
      // Remove script and style tags
      $('script, style, noscript, iframe, svg').remove();
      
      // Convert HTML to Markdown
      const markdown = nhm.translate(mainContent);
      
      // Skip pages with very little content (likely not documentation)
      if (markdown.length < 100) {
        return null;
      }
      
      // Format initial content with title and source
      const formattedContent = `# ${title}\n\nSource: ${url}\n\n${markdown}`;
      
      return {
        url: url,
        title: title,
        content: formattedContent
      };
    } catch (error) {
      // Just return null - we'll continue with other URLs
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
  // Exclude patterns that are likely not documentation pages
  const excludePatterns = [
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
  
  // If URL contains any exclude pattern, it's not a doc page
  if (excludePatterns.some(pattern => url.includes(pattern))) {
    return false;
  }
  
  // Otherwise, consider it a documentation page
  return true;
}