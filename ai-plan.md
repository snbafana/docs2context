# docs2context: Documentation Aggregator

## Project Goal
docs2context is a CLI tool that automates documentation scraping and aggregation. Users can input a project name, and docs2context will search for documentation, verify the correct project with the user, then scrape and compile all documentation into a single comprehensive markdown file.

## Implementation Plan

### 1. CLI Setup and Package Structure
- Create a JavaScript npm package with CLI functionality
- Support direct URL input or search-based operation
- Implement command structure: `docs2context add <project-name>` or `docs2context add --url <documentation-url>`
- Set up proper package.json, bin entry point, and dependencies

### 2. Search Capability
- Implement web search functionality to find documentation for a given project name
- Parse search results to identify likely documentation pages
- Present top results to the user for confirmation

### 3. User Interaction Flow
- Display search results with numbering for user selection
- Allow users to confirm the correct documentation source
- Implement interactive CLI experience with clear user feedback
- Handle errors gracefully with helpful messages

### 4. Link Discovery and Crawling
- Once documentation URL is confirmed, extract all links from the main page
- Identify navigation structure and documentation hierarchy
- Determine which links are part of the documentation vs external links
- Create a crawling queue to process all relevant documentation pages

### 5. Content Scraping and Processing
- Scrape content from all identified documentation pages
- Convert HTML content to clean, well-formatted markdown
- Preserve heading structure, code blocks, tables, and other formatting
- Handle images by either embedding or providing reference links
- Maintain proper cross-references between documentation sections

### 6. Output Generation
- Combine all scraped content into a single cohesive markdown document
- Create a logical structure with table of contents
- Add metadata about the original source and scraping date
- Save the output to a file with appropriate naming

### 7. Future Enhancements
- Add configuration options for controlling scraping depth and scope
- Implement caching to avoid re-scraping unchanged documentation
- Support multiple output formats (PDF, HTML, etc.)
- Add progress indicators for long-running operations