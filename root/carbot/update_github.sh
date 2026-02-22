#!/bin/bash

# Get commit message from user
read -p "Enter commit message: " COMMIT_MESSAGE

# Add all changes
git add .

# Commit with the provided message
git commit -m "$COMMIT_MESSAGE"

# Push to the main branch
git push origin main

echo "Changes have been pushed to GitHub successfully!"
