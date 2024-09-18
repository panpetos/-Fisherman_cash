const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

// Загрузка SSL-сертификатов для HTTPS
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

const players = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Добавляем нового игрока в список
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'St',
  };

  // Отправляем новому игроку его данные и данные всех остальных игроков
  socket.emit('initPlayer', players[socket.id], players);

  // Сообщаем остальным игрокам о новом игроке
  socket.broadcast.emit('updatePlayers', players);

  // Обработка движения и анимации игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Отправляем обновлённое состояние всем игрокам
      io.emit('updatePlayers', players);
    }
  });

  // Обработка отключения игрока
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete players[socket.id];

    // Сообщаем всем остальным игрокам об обновлении
    io.emit('updatePlayers', players);
  });
});

server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
