const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const players = {}; // Хранит состояние всех игроков

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Обновляем состояние игрока при его движении
  socket.on('playerMove', (data) => {
    players[data.id] = {
      position: data.position,
      rotation: data.rotation,
      animationName: data.animationName
    };
    io.emit('updatePlayers', players);
  });

  // Запрашиваем текущее состояние всех игроков
  socket.on('requestPlayers', () => {
    socket.emit('updatePlayers', players);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
