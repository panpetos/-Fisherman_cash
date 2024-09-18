#!/bin/bash

# Export Moscow time zone
export TZ="Europe/Moscow"

# Your bot token and chat_id
TELEGRAM_BOT_TOKEN="7116339146:AAHThGMs_UDxGxw2dxsIDluB7r3ZjO8ZOyI"
TELEGRAM_CHAT_ID="435740601"

# Get current time
CURRENT_TIME=$(date +"%H:%M")

# Deploy status message with time
DEPLOY_STATUS_MESSAGE="Деплой завершен успешно в ${CURRENT_TIME} (МСК)!"

# Step 1: Add files to git, commit, and push
git add .
git commit -m "$1"
git push origin master

# Step 2: SSH connect and deploy on the server
ssh -T root@brandingsite.store << 'EOF'
  cd Fisherman_cash/Fisherman_cash/my-multiplayer-app
  git pull origin master
  pm2 restart 5
  echo "Деплой на сервере завершен!"
EOF

# Step 3: Local project build
npm run build

# Step 4: Deploy on Netlify
netlify deploy --prod --dir=build

# Message about successful completion
echo "Все этапы деплоя завершены!"

# Step 5: Telegram notification
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${DEPLOY_STATUS_MESSAGE}"
