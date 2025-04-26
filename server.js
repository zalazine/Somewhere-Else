const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*"
  }
});
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const locations = [
  "โรงพยาบาล", "ห้างสรรพสินค้า", "โรงเรียน", "ชายหาด", "สนามบิน",
  "สวนสัตว์", "สนามกีฬา", "พิพิธภัณฑ์", "ร้านอาหาร", "โรงละคร",
  "ตลาดนัด", "ปั๊มน้ำมัน", "สวนสนุก", "มหาวิทยาลัย", "วัด",
  "สถานีรถไฟ", "ค่ายทหาร", "ห้องสมุด", "สวนน้ำ", "โรงแรม"
];

const rooms = {};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7);
}

function assignRoles(players) {
  const spyIndex = Math.floor(Math.random() * players.length);
  const location = locations[Math.floor(Math.random() * locations.length)];

  players.forEach((player, idx) => {
    if (idx === spyIndex) {
      player.role = 'spy';
      player.location = location; // อาจให้สปายเดา location ใกล้เคียงได้ในอนาคต
    } else {
      player.role = 'normal';
      player.location = location;
    }
  });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ name, mode }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [{ id: socket.id, name, score: 0, isHost: true }],
      mode,
      hostId: socket.id,
      votes: {}
    };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, mode, players: rooms[roomId].players, id: socket.id });
  });

  socket.on('joinRoom', ({ name, room }) => {
    const roomData = rooms[room];
    if (!roomData) return;

    roomData.players.push({ id: socket.id, name, score: 0, isHost: false });
    socket.join(room);
    io.to(room).emit('updatePlayers', roomData.players);
    socket.emit('joinedRoom', { roomId: room, mode: roomData.mode, players: roomData.players, id: socket.id, hostId: roomData.hostId });
  });

  socket.on('startGame', () => {
    const roomId = [...socket.rooms][1];
    const roomData = rooms[roomId];
    if (!roomData) return;

    assignRoles(roomData.players);

    roomData.players.forEach(player => {
      io.to(player.id).emit('gameStarted', {
        role: player.role,
        location: player.location,
        mode: roomData.mode
      });
    });
  });

  socket.on('startLightningRound', () => {
    const roomId = [...socket.rooms][1];
    io.to(roomId).emit('lightningRound');
  });

  socket.on('startVoting', () => {
    const roomId = [...socket.rooms][1];
    const roomData = rooms[roomId];
    if (!roomData) return;

    io.to(roomId).emit('startVoting', roomData.players);
    roomData.votes = {};
  });

  socket.on('vote', (votedId) => {
    const roomId = [...socket.rooms][1];
    const roomData = rooms[roomId];
    if (!roomData) return;

    roomData.votes[socket.id] = votedId;

    if (Object.keys(roomData.votes).length === roomData.players.length) {
      const voteCounts = {};
      Object.values(roomData.votes).forEach(id => {
        if (id) voteCounts[id] = (voteCounts[id] || 0) + 1;
      });

      let maxVotes = 0;
      let suspectId = null;
      for (const [id, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          suspectId = id;
        }
      }

      const suspect = roomData.players.find(p => p.id === suspectId);
      const spy = roomData.players.find(p => p.role === 'spy');
      let spyCaught = false;

      if (suspect && suspect.role === 'spy') {
        spyCaught = true;
        roomData.players.forEach(player => {
          if (player.role !== 'spy') player.score += 1;
        });
      } else {
        if (spy) spy.score += 2;
      }

      io.to(roomId).emit('voteResult', {
        spyCaught,
        winner: spy ? spy.name : "Unknown",
        players: roomData.players
      });
    }
  });

  socket.on('newRound', () => {
    const roomId = [...socket.rooms][1];
    const roomData = rooms[roomId];
    if (!roomData) return;

    assignRoles(roomData.players);

    roomData.players.forEach(player => {
      io.to(player.id).emit('gameStarted', {
        role: player.role,
        location: player.location,
        mode: roomData.mode
      });
    });
  });

  socket.on('endGame', () => {
    const roomId = [...socket.rooms][1];
    const roomData = rooms[roomId];
    if (!roomData) return;

    const winner = roomData.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    io.to(roomId).emit('finalResult', { winner: winner.name, score: winner.score });
    delete rooms[roomId];
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    for (const [roomId, roomData] of Object.entries(rooms)) {
      const idx = roomData.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        roomData.players.splice(idx, 1);
        io.to(roomId).emit('updatePlayers', roomData.players);

        if (roomData.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
