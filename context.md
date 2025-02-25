"add docs of x project" and the tool will go search the internet, find the project, confirm with the user about the project by asking the user a question, then go through every link on the page, pull out sub links, scrape all the links by converting them to markdown and put it all into one big doc.

this is the goal of the project. so, there should be

1. setting up this as a javascript npm package that can be ran from the cli (either can be ran direct with a link to docs or to search for docs)
2. implementing some search capability
3. presenting the results and allowing the user to specificy the package / docs of the tool that they are using. 
4. once the link is confirmed, finding all links/sublinks of the docs on the page by extracting the hrefs/links
5. MASS SCRAPING of the entire page. 