const io = require('socket.io')(3000);

const players = {};

io.on('connection', socket => {
  console.log('New player connected:', socket.id);
  
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'St'
  };

  socket.emit('updatePlayers', Object.values(players));
  
  socket.on('playerMove', data => {
    players[socket.id] = { ...players[socket.id], ...data };
    io.emit('updatePlayers', Object.values(players));
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', Object.values(players));
  });
});
