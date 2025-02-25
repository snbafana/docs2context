# docs2context

docs2context is a CLI tool that automates documentation scraping and aggregation. It can search for project documentation, verify with the user, then scrape and compile all documentation into a single comprehensive markdown file.

## Installation

```bash
# Install locally
npm install

# Link the CLI for development
npm link
```

## Usage

```bash
# Search for documentation by project name
docs2context add react

# Provide a direct URL to documentation
docs2context add express --url https://expressjs.com/

# Get help
docs2context --help
```

## Features

- Search for project documentation
- Interactive selection of correct documentation source
- Automatic crawling of documentation pages
- Conversion of HTML to well-formatted markdown
- Generation of table of contents
- Single file output with all documentation

## Development

This project is built with Node.js and uses the following dependencies:

- axios - For HTTP requests
- cheerio - For HTML parsing
- commander - For CLI commands
- inquirer - For interactive prompts
- node-html-markdown - For HTML to markdown conversion
- ora - For terminal spinners

## License

MIT