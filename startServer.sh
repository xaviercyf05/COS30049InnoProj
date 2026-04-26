#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status, if an undefined variable is used, or if any command in a pipeline fails
set -euo pipefail

# Enter file directory and check for updates
git pull --ff-only
npm install

# Start the server
if pm2 describe innopapp-api > /dev/null 2>&1; then
pm2 restart innopapp-api --update-env
echo "Innovation Project Server already exists and was successfully restarted at $(date)" >> /var/log/startup.log
else
pm2 start src/server.js --name innopapp-api --update-env
echo "Innovation Project Server successfully started at $(date)" >> /var/log/startup.log
fi

pm2 save