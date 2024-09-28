const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');

// Загрузка SSL-сертификатов
const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();

// Настройка CORS для всех запросов
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://eleonhrcenter.com');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://brandingsite.store', 'https://eleonhrcenter.com'],
    methods: ['GET', 'POST'],
    credentials: true, // Разрешаем передачу cookie и сессионных данных
  },
});

const players = {}; // Хранение данных о всех игроках

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

  // Обработка ICE кандидатов для WebRTC
  socket.on('iceCandidate', (candidate) => {
    socket.broadcast.emit('iceCandidate', candidate);
  });
});

server.listen(5000, () => {
  console.log('Сервер запущен на https://brandingsite.store:5000');
});
