const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// Подгружаем SSL-сертификаты
const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://eleonhrcenter.com'],
    methods: ['GET', 'POST']
  }
});

const players = {}; // Хранение данных о всех игроках

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Добавляем нового игрока
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'St'
  };

  // Отправляем текущий список игроков новому игроку
  socket.emit('updatePlayers', Object.values(players));

  // Обновляем данные игроков для всех клиентов
  socket.broadcast.emit('updatePlayers', Object.values(players));

  // Обработка движения игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Обновляем данные игроков для всех клиентов
      io.emit('updatePlayers', Object.values(players));
    }
  });

  // Удаляем игрока при отключении
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', Object.values(players));
    console.log('Client disconnected', socket.id);
  });
});

// Запускаем сервер на порту 5000 через HTTPS
server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
