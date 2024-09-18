#!/bin/bash

# Ваш токен бота и chat_id
TELEGRAM_BOT_TOKEN="7116339146:AAHThGMs_UDxGxw2dxsIDluB7r3ZjO8ZOyI"
TELEGRAM_CHAT_ID="435740601"

# Получение текущего времени по МСК
CURRENT_TIME=$(TZ="Europe/Moscow" date +"%H:%M")

# Сообщение о статусе деплоя с указанием времени
DEPLOY_STATUS_MESSAGE="Деплой завершен успешно в ${CURRENT_TIME} (МСК)!"

# Шаг 1: Добавление файлов в git, коммит и пуш
git add .
git commit -m "$1"
git push origin master

# Шаг 2: SSH подключение и деплой на сервере
ssh -T root@brandingsite.store << 'EOF'
  cd Fisherman_cash/Fisherman_cash/my-multiplayer-app
  git pull origin master
  pm2 restart 5
  echo "Деплой на сервере завершен!"
EOF

# Шаг 3: Локальная сборка проекта
npm run build

# Шаг 4: Деплой на Netlify
netlify deploy --prod --dir=build

# Сообщение об успешном завершении
echo "Все этапы деплоя завершены!"

# Шаг 5: Уведомление в Telegram
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TELEGRAM_CHAT_ID}" \
    -d text="${DEPLOY_STATUS_MESSAGE}"

