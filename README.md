# docs2context COMING SOON

docs2context is a CLI tool that automates documentation scraping, cleaning, and aggregation. It intelligently searches for project documentation, crawls through related pages, and compiles everything into a single comprehensive markdown file optimized for context integration.

## Installation

```bash
# Install locally
npm install

# Link the CLI for development
npm link

# Set up required API key for GPT-4o-mini content cleaning
export OPENAI_API_KEY=your_api_key
```

## Usage

(express as an example, replace with any package/library)

```bash
# Search for documentation by project name
docs2context express

# Provide a direct URL to documentation
docs2context express -u https://expressjs.com/
# or
docs2context express --url https://expressjs.com/

# Disable AI cleaning (faster but less refined output)
docs2context express --disable-ai

# Control concurrent processing (default: 10)
docs2context express --concurrency 20

# Get help
docs2context --help
```

## Features

- **Intelligent Documentation Search**: Utilizes DuckDuckGo to find the most relevant documentation for any project
- **Interactive Selection**: Lets you choose the correct documentation source before proceeding
- **Advanced Multi-Level Crawling**: 
  - Recursively crawls up to 4 levels deep on the documentation website
  - Intelligently follows only relevant documentation links
  - Avoids duplicates and non-documentation content
- **Parallel Processing Architecture**:
  - Processes multiple pages concurrently for maximum efficiency
  - Configurable concurrency levels (--concurrency option)
  - Optimized to avoid overwhelming target servers
- **AI-Powered Content Cleaning**:
  - Uses GPT-4o-mini to enhance documentation quality
  - Removes navigation elements, ads, and irrelevant content
  - Fixes formatting issues and improves readability
  - Can be disabled for faster processing (--disable-ai option)
- **Complete Documentation Package**:
  - Automatically generates a table of contents
  - Organizes content in logical order (introductory content first)
  - Preserves all code examples and technical information
  - Delivers a single markdown file ready for use

## Advanced Options

| Option | Description |
|--------|-------------|
| `--url <url>` | Provide a direct URL to documentation source |
| `--disable-ai` | Skip AI cleaning of content (faster but less refined) |
| `--concurrency <number>` | Set the number of concurrent operations (default: 10) |
| `--verbose` | Enable verbose logging for debugging |
| `--output <path>` | Specify custom output file path |

## Development

This project is built with Node.js and leverages:

- **Core Web Technologies**:
  - axios - For efficient HTTP requests
  - cheerio - For powerful HTML parsing
  - node-html-markdown - For HTML to markdown conversion
  
- **AI Integration**:
  - OpenAI API - For content cleaning and enhancement
  
- **Concurrency & Performance**:
  - p-queue - For controlled parallel processing
  
- **User Experience**:
  - commander - For elegant CLI commands
  - inquirer - For interactive prompts
  - ora - For informative terminal spinners

## How It Works

1. **Discovery Phase**: 
   - Searches for documentation or uses provided URL
   - Confirms with user to ensure correct source
   
2. **Crawling Phase**:
   - Builds a graph of documentation pages through recursive crawling
   - Filters to focus only on relevant documentation pages
   
3. **Processing Phase**:
   - Scrapes content in batches with controlled concurrency
   - Intelligently extracts the main content from each page
   - Optionally cleans and enhances content with GPT-4o-mini
   
4. **Compilation Phase**:
   - Sorts pages in logical reading order
   - Generates comprehensive table of contents
   - Compiles everything into a single markdown file

## License

MIT