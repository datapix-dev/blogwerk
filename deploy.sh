#!/bin/bash
set -e

SERVER="root@202.61.194.129"
DEPLOY_PATH="/var/www/blogwerk"

echo "Deploying to $SERVER:$DEPLOY_PATH ..."

ssh $SERVER "
  cd $DEPLOY_PATH
  git pull origin main
  docker compose -f docker-compose.prod.yml build --no-cache
  docker compose -f docker-compose.prod.yml up -d
  docker compose -f docker-compose.prod.yml exec web npx prisma db push --accept-data-loss
  echo 'Deploy complete'
"
