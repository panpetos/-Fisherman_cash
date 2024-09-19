const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');

// Загрузка SSL-сертификатов
const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://brandingsite.store', 'https://eleonhrcenter.com'], // Разрешенные домены
    methods: ['GET', 'POST'],
  },
});

const players = {}; // Хранение данных о всех игроках

io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);

  // Инициализируем нового игрока с дефолтными значениями
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'Idle', // Начальная анимация
  };

  // Отправляем состояние новому игроку
  socket.emit('initPlayer', players[socket.id], players);

  // Сообщаем всем остальным игрокам о новом подключившемся игроке
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Когда игрок движется, обновляем его состояние и отправляем это всем
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Обновляем данные всех игроков
      io.emit('updatePlayers', players);
    }
  });

  // Удаление игрока при отключении
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);

    // Удаляем игрока из списка
    delete players[socket.id];

    // Сообщаем всем остальным игрокам, что игрок отключился
    io.emit('updatePlayers', players);
  });
});

// Запуск HTTPS сервера на порту 5000
server.listen(5000, () => {
  console.log('Сервер запущен на https://brandingsite.store:5000');
});
