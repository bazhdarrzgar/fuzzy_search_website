#!/bin/bash

# Script to automate GitHub upload

# Ensure we are in the git repository
if [ ! -d .git ]; then
    echo "Error: Not a git repository."
    exit 1
fi

# Check for changes
if [[ -z $(git status -s) ]]; then
    echo "No changes to upload."
    exit 0
fi

# Show status
git status

# Ask for commit message
echo "Enter commit message (or press enter for 'Auto-update'):"
read commit_message

if [ -z "$commit_message" ]; then
    commit_message="Auto-update"
fi

# Add all changes
git add .

# Commit
git commit -m "$commit_message"

# Get current branch
current_branch=$(git rev-parse --abbrev-ref HEAD)

# Push
echo "Pushing to origin $current_branch..."
git push origin "$current_branch"

echo "Upload complete!"
