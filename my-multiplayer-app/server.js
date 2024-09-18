const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// SSL сертификаты
const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Инициализация Express приложения
const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://eleonhrcenter.com'],  // Укажите допустимые источники для CORS
    methods: ['GET', 'POST'],
  },
});

const players = {};

// Обработка подключений
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Инициализация нового игрока с базовыми параметрами
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],  // Начальная позиция
    rotation: 0,          // Начальная ориентация
    animationName: 'St',  // Начальная анимация (стоит на месте)
  };

  // Отправляем новому игроку его состояние и состояние всех игроков
  socket.emit('initPlayer', players[socket.id], players);

  // Обработка движения игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      // Обновляем положение, поворот и анимацию игрока
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Передаем обновленные данные всем другим игрокам, кроме текущего
      socket.broadcast.emit('updatePlayers', {
        [socket.id]: players[socket.id],
      });
    }
  });

  // Обработка отключения игрока
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete players[socket.id];  // Удаляем игрока из списка
    io.emit('updatePlayers', players);  // Обновляем состояние всех игроков для остальных клиентов
  });
});

// Запуск сервера
server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
