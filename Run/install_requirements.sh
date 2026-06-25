#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Checking system requirements...${NC}"

# Check for Node.js and nub
NODE_EXISTS=false
NUB_EXISTS=false

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_EXISTS=true
fi

if command -v nub &> /dev/null; then
    NUB_EXISTS=true
fi

if [ "$NODE_EXISTS" = true ]; then
    if [ "$NUB_EXISTS" = false ]; then
        echo -e "${YELLOW}nub was not found. Attempting to install nub...${NC}"
        if command -v npm &> /dev/null; then
            echo -e "${BLUE}Installing nub globally via npm...${NC}"
            npm install -g --ignore-scripts=false @nubjs/nub
        else
            echo -e "${BLUE}Installing nub via curl...${NC}"
            curl -fsSL https://nubjs.com/install.sh | bash
            # Try to add nub to PATH for this script session
            export PATH="$HOME/.nub/bin:$PATH"
        fi
        
        if command -v nub &> /dev/null; then
            NUB_EXISTS=true
        else
            echo -e "${YELLOW}Could not install nub automatically. Please install it manually:${NC}"
            echo "curl -fsSL https://nubjs.com/install.sh | bash"
            exit 1
        fi
    fi
    
    NUB_VERSION=$(nub --version 2>/dev/null || nub -v 2>/dev/null || echo "installed")
    echo -e "${GREEN}Requirements (Node.js and nub) already exist and are up to date.${NC}"
    echo -e "${BLUE}Current Node version: $NODE_VERSION${NC}"
    echo -e "${BLUE}Current nub version: $NUB_VERSION${NC}"
else
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js (v18+) from https://nodejs.org/${NC}"
    exit 1
fi

echo -e "${BLUE}Installing/Updating project dependencies (node_modules) using nub...${NC}"
nub install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}--------------------------------------------------${NC}"
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
    echo -e "${BLUE}You can now run the project using: ./Run/launcher.sh${NC}"
    echo -e "${GREEN}--------------------------------------------------${NC}"
else
    echo -e "${YELLOW}Error occurred during nub install. Please check the logs above.${NC}"
    exit 1
fi
