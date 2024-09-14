const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'https://ваш_домен_клиента.com', // Укажите домен, с которого будут разрешены запросы
    methods: ['GET', 'POST']
  }
});

// Настройка CORS для всех маршрутов
app.use(cors());

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('playerMove', (data) => {
    socket.broadcast.emit('playerMove', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
