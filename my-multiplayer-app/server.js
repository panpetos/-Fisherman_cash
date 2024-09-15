const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://eleonhrcenter.com', 'http://localhost:3000'],  // HTTP версии ваших сайтов
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Настройка CORS для всех маршрутов
app.use(cors({
  origin: ['http://eleonhrcenter.com', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Ваш код для работы с сокетами и маршрутами
const players = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'St'
  };

  io.emit('updatePlayers', Object.values(players));

  socket.on('playerMove', (data) => {
    players[data.id] = {
      ...players[data.id],
      position: data.position,
      rotation: data.rotation,
      animationName: data.animationName
    };

    io.emit('updatePlayers', Object.values(players));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', Object.values(players));
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
