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
    credentials: true,
  },
});

const players = {};

io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);

  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animation: 'Idle',
  };

  socket.emit('initPlayer', players[socket.id], players);
  socket.broadcast.emit('updatePlayers', players);

  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      players[socket.id].rotation = data.rotation;
      players[socket.id].animation = data.animation;
      io.emit('updatePlayers', players);
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });

  // Обработка WebRTC предложений
  socket.on('offer', ({ to, offer }) => {
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('iceCandidate', ({ to, candidate }) => {
    socket.to(to).emit('iceCandidate', { from: socket.id, candidate });
  });
});

server.listen(5000, () => {
  console.log('Сервер запущен на https://brandingsite.store:5000');
});
