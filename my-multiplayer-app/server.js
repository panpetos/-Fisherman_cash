const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// Загрузка SSL-сертификатов
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

// Хранение состояния всех игроков
const players = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Инициализация нового игрока
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'St',
  };

  // Отправляем новому игроку данные обо всех игроках
  socket.emit('initPlayer', players[socket.id], players);

  // Уведомляем всех клиентов о новом игроке
  socket.broadcast.emit('updatePlayers', players);

  // Обработка движения игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      // Обновление данных игрока на сервере
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Обновляем всех клиентов
      io.emit('updatePlayers', players);
    }
  });

  // Обработка отключения игрока
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete players[socket.id]; // Удаление игрока из списка

    // Обновляем всех клиентов
    io.emit('updatePlayers', players);
  });
});

// Запуск сервера
server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
