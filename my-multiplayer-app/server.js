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
    origin: ['https://brandingsite.store'],
    methods: ['GET', 'POST'],
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

  socket.on('sendOffer', ({ to, offer }) => {
    io.to(to).emit('receiveOffer', { from: socket.id, offer });
  });

  socket.on('sendAnswer', ({ to, answer }) => {
    io.to(to).emit('receiveAnswer', { from: socket.id, answer });
  });

  socket.on('sendCandidate', ({ to, candidate }) => {
    io.to(to).emit('receiveCandidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

server.listen(5000, () => {
  console.log('Сервер запущен на https://brandingsite.store:5000');
});
