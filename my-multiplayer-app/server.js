const io = require('socket.io')(5000, {
  cors: {
    origin: '*', // Разрешаем любые запросы
  },
});

let players = {}; // Храним всех игроков

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Когда игрок двигается, обновляем его данные
  socket.on('playerMove', (data) => {
    players[socket.id] = {
      id: socket.id,
      position: data.position,
      rotation: data.rotation,
      animationName: data.animationName,
    };
    // Отправляем обновление всех игроков всем
    io.emit('updatePlayers', players);
  });

  // Когда игрок отключается, удаляем его из списка
  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('updatePlayers', players); // Обновляем всех после удаления
    console.log('Player disconnected:', socket.id);
  });
});
