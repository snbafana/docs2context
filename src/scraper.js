import axios from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { URL } from 'url';
import OpenAI from 'openai';
import PQueue from 'p-queue'; // Import p-queue for better concurrency control
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
 * @param {Object} options - Scraping options
 * @param {boolean} options.disableAI - Whether to disable AI cleaning
 * @param {number} options.concurrency - Number of concurrent operations
 * @returns {Promise<string>} - Combined markdown content
 */
export async function scrapeContent(startUrl, options = {}) {
  // Set default options
  const {
    disableAI = false,
    concurrency = 10
  } = options;
  
  const baseUrl = new URL(startUrl).origin;
  const baseDomain = new URL(startUrl).hostname;
  
  displayInfo(`Starting documentation scrape from ${formatUrl(startUrl)}`);
  displayInfo(`Base URL: ${formatUrl(baseUrl)}`);
  displayInfo(`Base Domain: ${baseDomain}`);
  if (disableAI) {
    displayInfo(`AI cleaning is disabled`);
  }
  
  logInfo(`Starting documentation scrape from ${startUrl}`);
  logInfo(`Using base URL: ${baseUrl}`);
  logInfo(`Using base domain: ${baseDomain}`);
  
  // Create queue for concurrent operations
  const crawlQueue = new PQueue({ concurrency });
  const scrapeQueue = new PQueue({ concurrency });
  const aiQueue = new PQueue({ concurrency: Math.min(5, concurrency) }); // Limit AI concurrency to avoid rate limits
  
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
  
  // Batch size for progress updates
  const progressUpdateSize = 20;
  let processedCount = 0;
  let crawlProgressUpdate = 0;
  
  // Extract links from a URL and add them to the queue
  async function processUrl(url) {
    try {
      // Mark as visited before processing
      visitedUrls.add(url);
      
      // Get current depth
      const depth = urlDepth.get(url) || 1;
      
      // Skip if we've reached max depth
      if (depth > maxDepth) return;
      
      // Update spinner occasionally (not on every URL to reduce overhead)
      processedCount++;
      if (processedCount - crawlProgressUpdate >= progressUpdateSize) {
        crawler.text = `Crawling level ${depth}... (${formatCount(visitedUrls.size)} visited, ${formatCount(discoveredUrls.size)} discovered)`;
        crawlProgressUpdate = processedCount;
      }
      
      // Extract links from URL
      const links = await extractLinksFromUrl(url, baseDomain);
      const linksArray = Array.isArray(links) ? links : [];
      
      // Process each link
      const nextDepth = depth + 1;
      for (const link of linksArray) {
        // If we haven't discovered this URL yet
        if (!discoveredUrls.has(link)) {
          // Add to discovered set
          discoveredUrls.add(link);
          // Set depth
          urlDepth.set(link, nextDepth);
          
          // If it's likely a documentation page, increment counter
          if (isLikelyDocPage(link)) {
            docPagesCount++;
          }
          
          // Add to queue for processing if we haven't reached max depth
          if (nextDepth <= maxDepth) {
            // Queue the link for crawling
            crawlQueue.add(() => processUrl(link));
          }
        }
      }
    } catch (error) {
      logWarning(`Failed to process ${url}: ${error.message}`);
    }
  }
  
  // Start with the initial URL
  await crawlQueue.add(() => processUrl(startUrl));
  
  // Wait for all crawling to complete
  await crawlQueue.onIdle();
  
  // Log completion
  crawler.succeed(`Recursive crawl complete. Visited ${formatCount(visitedUrls.size)} URLs, discovered ${formatCount(discoveredUrls.size)} URLs`);
  logSuccess(`Found ${docPagesCount} likely documentation pages`);
  
  // Get all URLs we've discovered
  const allUrlsArray = Array.from(discoveredUrls);
  
  // Filter URLs to only include likely documentation pages
  const docUrls = allUrlsArray.filter(url => isLikelyDocPage(url));
  
  crawler.succeed(`Found ${formatCount(docUrls.length)} documentation pages across ${maxDepth} levels`);
  logSuccess(`Discovered ${docUrls.length} documentation pages through crawling`);
  
  // Now scrape content from all the discovered URLs
  const spinner = createSpinner('Scraping documentation content...');
  spinner.start();
  
  const maxPages = 500; // Limit to 500 pages for safety
  const pagesToProcess = docUrls.slice(0, maxPages);
  
  const pages = [];
  let pageCount = 0;
  let scrapeProgressUpdate = 0;
  
  // Create a scraping task for each URL
  const scrapingTasks = pagesToProcess.map(url => async () => {
    try {
      const content = await scrapePageContent(url);
      pageCount++;
      
      // Update spinner occasionally
      if (pageCount - scrapeProgressUpdate >= progressUpdateSize) {
        spinner.text = `Scraping content... (${formatCount(pageCount)}/${pagesToProcess.length} pages)`;
        scrapeProgressUpdate = pageCount;
      }
      
      if (content) {
        logSuccess(`Successfully scraped content from ${url}`);
        return content;
      }
    } catch (error) {
      logWarning(`Failed to scrape content from ${url}: ${error.message}`);
    }
    return null;
  });
  
  // Add all scraping tasks to the queue
  const scrapedPages = await Promise.all(
    scrapingTasks.map(task => scrapeQueue.add(task))
  );
  
  // Filter out null results
  const validPages = scrapedPages.filter(Boolean);
  
  if (validPages.length === 0) {
    spinner.fail('No documentation pages were successfully scraped');
    logError('Failed to scrape any documentation pages');
    return "No documentation content could be scraped.";
  }
  
  spinner.succeed(`Scraped content from ${formatCount(validPages.length)} documentation pages`);
  logSuccess(`Successfully scraped content from ${validPages.length} documentation pages`);
  
  // Clean content with AI if not disabled
  if (!disableAI) {
    spinner.text = 'Cleaning content with GPT-4o-mini...';
    spinner.start();
    
    let aiPageCount = 0;
    let aiScrapeProgressUpdate = 0;
    
    // Create cleaning tasks
    const cleaningTasks = validPages.map(page => async () => {
      try {
        const cleanedContent = await cleanMarkdownWithAI(page.content, page.title, page.url);
        aiPageCount++;
        
        // Update spinner occasionally
        if (aiPageCount - aiScrapeProgressUpdate >= progressUpdateSize) {
          spinner.text = `Cleaning content with GPT-4o-mini... (${formatCount(aiPageCount)}/${validPages.length} pages)`;
          aiScrapeProgressUpdate = aiPageCount;
        }
        
        logSuccess(`AI cleaned content for ${page.url}`);
        return {
          ...page,
          content: cleanedContent
        };
      } catch (error) {
        logWarning(`AI cleaning failed for ${page.url}: ${error.message}`);
        return page; // Return original page if cleaning fails
      }
    });
    
    // Process cleaning tasks in parallel with controlled concurrency
    const cleanedPages = await Promise.all(
      cleaningTasks.map(task => aiQueue.add(task))
    );
    
    spinner.succeed(`Cleaned ${formatCount(cleanedPages.length)} pages with GPT-4o-mini`);
    pages.push(...cleanedPages);
  } else {
    // Skip AI cleaning
    pages.push(...validPages);
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