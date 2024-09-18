#!/bin/bash

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
