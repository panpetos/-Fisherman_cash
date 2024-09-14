const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', // Для локальной разработки клиента
    methods: ['GET', 'POST']
  }
});

// Настройка CORS для всех маршрутов
app.use(cors());

let players = []; // Массив для хранения всех игроков

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  // Добавляем нового игрока
  players.push({ id: socket.id, position: [0, 0, 0], rotation: 0, animationName: 'St' });

  // Уведомляем всех игроков о новом подключении
  io.emit('updatePlayers', players);
  console.log(`+1 player connected. Total players: ${players.length}`);

  // Обработка движения игрока
  socket.on('playerMove', (data) => {
    // Обновляем данные игрока
    const player = players.find(p => p.id === socket.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
      player.animationName = data.animationName;
    }
    // Отправляем обновлённые данные всем остальным
    socket.broadcast.emit('playerMove', data);
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    players = players.filter(player => player.id !== socket.id); // Удаляем игрока из списка
    io.emit('updatePlayers', players); // Обновляем список игроков на клиенте
    console.log(`-1 player disconnected. Total players: ${players.length}`);
  });
});

// Каждые 20 секунд выводим количество игроков
setInterval(() => {
  console.log(`Current number of players: ${players.length}`);
}, 20000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
