#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building the application for production...${NC}"
nub run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build successful! Starting production server...${NC}"
    # Run the production server
    nub run start
else
    echo -e "${YELLOW}Build failed. Please check the errors above.${NC}"
    exit 1
fi
