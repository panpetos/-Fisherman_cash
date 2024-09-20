io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);

  // Инициализируем нового игрока с дефолтной позицией
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
  };

  // Отправляем состояние новому игроку
  socket.emit('initPlayer', players[socket.id], players);

  // Обновляем состояние всех игроков для новоподключенного
  socket.broadcast.emit('updatePlayers', players);

  // Обновляем данные игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].position = data.position;
      io.emit('updatePlayers', players); // Передаем обновленные данные всем игрокам
    }
  });

  // Handle fishing animation
  socket.on('startFishingAnimation', (data) => {
    if (players[data.id]) {
      console.log(`Player ${data.id} is casting the fishing line!`);
      io.emit('fishingAction', data); // Broadcast to all players
    }
  });

  // Удаление игрока при отключении
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id]; // Удаляем игрока из списка
    io.emit('updatePlayers', players); // Обновляем состояние для всех клиентов
  });
});
