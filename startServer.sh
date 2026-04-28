#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status, if an undefined variable is used, or if any command in a pipeline fails
set -euo pipefail

# Always run from the project root, even when started manually.
cd "$(dirname "$0")"

git pull --ff-only
npm install

if pm2 describe innopapp-api > /dev/null 2>&1; then
	pm2 restart innopapp-api --update-env
	echo "Innovation Project Server already exists and was restarted at $(date)"
else
	pm2 start src/server.js --name innopapp-api --update-env
	echo "Innovation Project Server was started at $(date)"
fi

pm2 save