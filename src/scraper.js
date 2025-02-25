import axios from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { URL } from 'url';
import ora from 'ora';

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
  
  console.log(`Starting scrape at ${startUrl}`);
  console.log(`Using base URL: ${baseUrl}`);
  
  const spinner = ora('Discovering documentation pages...').start();
  let pageCount = 0;
  
  while (queue.length > 0 && pageCount < 50) { // Limit to 50 pages for safety
    const currentUrl = queue.shift();
    
    if (visited.has(currentUrl)) {
      continue;
    }
    
    visited.add(currentUrl);
    pageCount++;
    
    spinner.text = `Discovering documentation pages... (${pageCount} found)`;
    
    try {
      const response = await axios.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const title = $('title').text() || currentUrl;
      
      // Extract content from main documentation area
      // This would need to be customized for different documentation sites
      let mainContent = $('main').html() || 
                     $('#main-content').html() || 
                     $('.main-content').html() || 
                     $('.documentation').html() ||
                     $('.content').html() ||
                     $('article').html() ||
                     $('body').html();
      
      if (!mainContent) {
        continue;
      }
      
      // Convert HTML to Markdown
      const markdown = nhm.translate(mainContent);
      
      pages.push({
        url: currentUrl,
        title: title,
        content: `# ${title}\n\nSource: ${currentUrl}\n\n${markdown}`
      });
      
      // Find links to other documentation pages
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
          isLikelyDocPage(resolvedUrl)
        ) {
          queue.push(resolvedUrl);
        }
      });
    } catch (error) {
      console.warn(`Failed to fetch ${currentUrl}: ${error.message}`);
    }
  }
  
  spinner.succeed(`Discovered ${pages.length} documentation pages`);
  
  // Sort pages to try to get a logical order
  pages.sort((a, b) => {
    // Check if URL contains "intro", "getting-started", etc.
    const introTerms = ['intro', 'getting-started', 'overview', 'index', 'readme'];
    const aHasIntro = introTerms.some(term => a.url.toLowerCase().includes(term));
    const bHasIntro = introTerms.some(term => b.url.toLowerCase().includes(term));
    
    if (aHasIntro && !bHasIntro) return -1;
    if (!aHasIntro && bHasIntro) return 1;
    
    // Otherwise sort alphabetically by title
    return a.title.localeCompare(b.title);
  });
  
  // Create table of contents
  let toc = '# Table of Contents\n\n';
  pages.forEach((page, index) => {
    toc += `${index + 1}. [${page.title}](#${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')})\n`;
  });
  
  // Combine all content
  const combinedContent = [
    `# Documentation\n\nAutomatically aggregated documentation from ${startUrl}\n\n`,
    toc,
    ...pages.map(page => page.content)
  ].join('\n\n---\n\n');
  
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
    '/getting-started'
  ];
  
  return docPatterns.some(pattern => url.includes(pattern)) ||
         url.endsWith('.html') || 
         !url.includes('.');
}