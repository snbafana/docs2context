#!/bin/bash

# Install dependencies
npm install

# Make CLI executable
chmod +x bin/docs2context.js

# Link package globally for development
npm link

echo "docs2context setup complete!"
echo "Try running: docs2context add react"