const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'https://66e619a9a1ec47f1c1e3853b--magical-cucurucho-5ce770.netlify.app',
    methods: ['GET', 'POST']
  }
});

// Настройка CORS для всех маршрутов
app.use(cors());

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Отправляем всем клиентам данные о подключении нового клиента
  io.emit('playerCount', io.engine.clientsCount);

  socket.on('playerMove', (data) => {
    socket.broadcast.emit('playerMove', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);

    // Отправляем всем клиентам данные о дисконнекте клиента
    io.emit('playerCount', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
