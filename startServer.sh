#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status, if an undefined variable is used, or if any command in a pipeline fails
set -euo pipefail

# Enter file directory and check for updates
cd /home/xavier/COS30049InnoProj/COS30049InnoProj
git pull
npm install

# Start the server
if pm2 describe innopapp-api > /dev/null 2>&1; then
pm2 restart innopapp-api --update-env
else
pm2 start server.js --name innopapp-api --update-env
fi

pm2 save