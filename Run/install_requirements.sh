#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Checking system requirements...${NC}"

# Check for Node.js and npm
NODE_EXISTS=false
NPM_EXISTS=false

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_EXISTS=true
fi

if command -v npm &> /dev/null; then
    NPM_EXISTS=true
fi

if [ "$NODE_EXISTS" = true ] && [ "$NPM_EXISTS" = true ]; then
    echo -e "${GREEN}Requirements (Node.js and npm) already exist and are up to date.${NC}"
    echo -e "${BLUE}Current Node version: $NODE_VERSION${NC}"
else
    if [ "$NODE_EXISTS" = false ]; then
        echo -e "${YELLOW}Node.js is not installed. Please install Node.js (v18+) from https://nodejs.org/${NC}"
        exit 1
    fi
    if [ "$NPM_EXISTS" = false ]; then
        echo -e "${YELLOW}npm is not installed. Please install npm (usually comes with Node.js).${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}Installing/Updating project dependencies (node_modules)...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}--------------------------------------------------${NC}"
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
    echo -e "${BLUE}You can now run the project using: ./Run/launcher.sh${NC}"
    echo -e "${GREEN}--------------------------------------------------${NC}"
else
    echo -e "${YELLOW}Error occurred during npm install. Please check the logs above.${NC}"
    exit 1
fi
