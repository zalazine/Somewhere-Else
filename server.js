const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*'
  }
});
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {};
const locations = [
  'ชายหาด', 'ร้านกาแฟ', 'โรงพยาบาล', 'ห้างสรรพสินค้า', 'โรงเรียน', 'สนามบิน',
  'โรงหนัง', 'พิพิธภัณฑ์', 'สวนสนุก', 'สวนสาธารณะ', 'ฟิตเนส', 'ร้านอาหาร',
  'ตลาดสด', 'โรงแรม', 'สถานีตำรวจ', 'คลินิกสัตว์', 'สนามกีฬา', 'สระว่ายน้ำ',
  'ค่ายทหาร', 'คาเฟ่แมว'
];

io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerName, mode }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName, score: 0 }],
      hostId: socket.id,
      mode: mode,
      started: false,
      spyCount: 1,
      spyIndices: [],
      votes: {},
    };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, mode });
    io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (rooms[roomId]) {
      rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, mode: rooms[roomId].mode });
      io.to(roomId).emit('updatePlayerList', rooms[roomId].players);
    } else {
      socket.emit('error', 'ไม่พบห้อง');
    }
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      assignRoles(roomId);
      room.started = true;
    }
  });

  socket.on('vote', ({ roomId, votedId }) => {
    const room = rooms[roomId];
    if (room) {
      room.votes[socket.id] = votedId;
      if (Object.keys(room.votes).length === room.players.length) {
        endRound(roomId);
      }
    }
  });

  socket.on('newRound', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.started = false;
      room.votes = {};
      room.spyIndices = [];
      assignRoles(roomId);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(player => player.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('updatePlayerList', room.players);
      }
    }
  });
});

function assignRoles(roomId) {
  const room = rooms[roomId];
  const players = room.players;
  const realLocation = getRandomLocation();
  const spyIndices = [];

  while (spyIndices.length < room.spyCount) {
    const randomIndex = Math.floor(Math.random() * players.length);
    if (!spyIndices.includes(randomIndex)) {
      spyIndices.push(randomIndex);
    }
  }

  players.forEach((player, index) => {
    if (spyIndices.includes(index)) {
      const fakeLocation = getRandomFakeLocation(realLocation);
      io.to(player.id).emit('receiveRole', { role: 'spy', location: fakeLocation });
    } else {
      io.to(player.id).emit('receiveRole', { role: 'civilian', location: realLocation });
    }
  });

  room.location = realLocation;
  room.spyIndices = spyIndices;
}

function endRound(roomId) {
  const room = rooms[roomId];
  const voteCount = {};
  for (const voter in room.votes) {
    const voted = room.votes[voter];
    if (!voteCount[voted]) voteCount[voted] = 0;
    voteCount[voted]++;
  }

  const maxVotes = Math.max(...Object.values(voteCount));
  const candidates = Object.keys(voteCount).filter(id => voteCount[id] === maxVotes);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const isSpyCaught = room.spyIndices.includes(room.players.findIndex(player => player.id === selected));

  if (isSpyCaught) {
    room.players.forEach(player => {
      if (!room.spyIndices.includes(room.players.indexOf(player))) {
        player.score += 1;
      }
    });
  } else {
    room.spyIndices.forEach(index => {
      room.players[index].score += 2;
    });
  }

  io.to(roomId).emit('roundEnded', {
    isSpyCaught,
    spyNames: room.spyIndices.map(i => room.players[i].name),
    players: room.players,
  });
}

function generateRoomId() {
  return Math.random().toString(36).substr(2, 5);
}

function getRandomLocation() {
  return locations[Math.floor(Math.random() * locations.length)];
}

function getRandomFakeLocation(realLocation) {
  const otherLocations = locations.filter(loc => loc !== realLocation);
  return otherLocations[Math.floor(Math.random() * otherLocations.length)];
}

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
