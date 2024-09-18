const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// Загружаем SSL-сертификаты для HTTPS
const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://eleonhrcenter.com'],
    methods: ['GET', 'POST'],
  },
});

// Храним состояние всех игроков
const players = {};

// Функция проверки, двигается ли игрок
const isPlayerStationary = (player) => {
  return (
    player.position[0] === player.previousPosition[0] &&
    player.position[1] === player.previousPosition[1] &&
    player.position[2] === player.previousPosition[2]
  );
};

// Обрабатываем подключения
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Добавляем нового игрока
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0], // Изначальная позиция
    previousPosition: [0, 0, 0], // Для проверки на движение
    rotation: 0, // Изначальный угол поворота
    animationName: 'St', // Изначальная анимация стояния
  };

  // Отправляем новому игроку данные обо всех игроках
  socket.emit('initPlayer', players[socket.id], players);

  // Отправляем всем игрокам обновлённый список игроков с новым игроком
  socket.broadcast.emit('updatePlayers', players);

  // Обрабатываем событие перемещения игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      // Обновляем данные игрока на сервере
      players[socket.id].previousPosition = players[socket.id].position; // Сохраняем предыдущую позицию для проверки
      players[socket.id].position = data.position; // Обновляем позицию
      players[socket.id].rotation = data.rotation; // Обновляем угол поворота
      players[socket.id].animationName = data.animationName; // Обновляем анимацию

      // Проверяем, двигается ли игрок
      if (isPlayerStationary(players[socket.id])) {
        // Если игрок на месте, возвращаем анимацию стояния
        players[socket.id].animationName = 'St';
      }

      // Отправляем обновлённые данные всем клиентам
      io.emit('updatePlayers', players);
    }
  });

  // Обрабатываем отключение игрока
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    delete players[socket.id]; // Удаляем игрока из списка

    // Уведомляем всех игроков об удалении
    io.emit('updatePlayers', players);
  });
});

// Запускаем сервер на порту 5000 через HTTPS
server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
