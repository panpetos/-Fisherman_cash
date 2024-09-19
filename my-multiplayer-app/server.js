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
    origin: ['https://brandingsite.store', 'https://eleonhrcenter.com'],
    methods: ['GET', 'POST'],
  },
});

const players = {}; // Хранение данных о всех игроках

io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);

  // Инициализируем нового игрока с дефолтной позицией
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
  };

  // Отправляем состояние новому игроку
  socket.emit('initPlayer', players[socket.id], players);

  // Обновляем состояние всех игроков для новоподключенного
  socket.broadcast.emit('updatePlayers', players);

  // Обновляем данные игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      io.emit('updatePlayers', players); // Передаем обновленные данные всем игрокам
    }
  });

  // Удаление игрока при отключении
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id]; // Удаляем игрока из списка
    io.emit('updatePlayers', players); // Обновляем состояние для всех клиентов
  });
});

// Запуск HTTPS сервера на порту 5000
server.listen(5000, () => {
  console.log('Сервер запущен на https://brandingsite.store:5000');
});
