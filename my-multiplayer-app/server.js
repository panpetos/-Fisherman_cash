const fs = require('fs');
const https = require('https');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();

// Настройка HTTPS
const server = https.createServer({
  key: fs.readFileSync('/serf.crt'),   // Замените на путь к вашему SSL ключу
  cert: fs.readFileSync('/key.pem')   // Замените на путь к вашему SSL сертификату
}, app);

const io = socketIo(server, {
  cors: {
    origin: ['https://66e6a018273d2d5cd767cdc0--magical-cucurucho-5ce770.netlify.app', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: ['https://66e6a018273d2d5cd767cdc0--magical-cucurucho-5ce770.netlify.app', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

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

  // Отправляем всем клиентам обновленный список игроков
  io.emit('updatePlayers', Object.values(players));

  socket.on('playerMove', (data) => {
    // Обновляем данные игрока
    players[data.id] = {
      ...players[data.id],
      position: data.position,
      rotation: data.rotation,
      animationName: data.animationName
    };

    // Отправляем обновленные данные о движении всем клиентам
    io.emit('updatePlayers', Object.values(players));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);

    // Удаляем игрока из списка
    delete players[socket.id];

    // Отправляем всем клиентам обновленный список игроков
    io.emit('updatePlayers', Object.values(players));
  });
});

const PORT = process.env.PORT || 443; // Порт для HTTPS
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
