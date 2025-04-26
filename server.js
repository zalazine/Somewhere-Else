const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {}; // เก็บข้อมูลห้องทั้งหมด

io.on('connection', (socket) => {
  console.log('ผู้เล่นใหม่เชื่อมต่อ');

  socket.on('createRoom', ({ playerName, gameMode }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      started: false,
      gameMode: gameMode,
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    console.log(`สร้างห้องใหม่: ${roomCode}`);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (room && !room.started) {
      room.players.push({ id: socket.id, name: playerName, score: 0 });
      socket.join(roomCode);
      io.to(roomCode).emit('updatePlayerList', {
        players: room.players,
        hostId: room.hostId,
      });
      socket.emit('joinSuccess', { roomCode });
      console.log(`${playerName} เข้าห้อง ${roomCode}`);
    } else {
      socket.emit('joinFailed');
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room && socket.id === room.hostId && !room.started) {
      room.started = true;
      assignRoles(room);
      io.to(roomCode).emit('gameStarted', { players: room.players, gameMode: room.gameMode });
      console.log(`เริ่มเกมในห้อง ${roomCode}`);
    }
  });

  socket.on('submitVote', ({ roomCode, targetId }) => {
    const room = rooms[roomCode];
    if (room && room.votes) {
      room.votes[socket.id] = targetId;
      checkAllVotes(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log('ผู้เล่นหลุดออก');
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          delete rooms[roomCode];
          console.log(`ลบห้อง ${roomCode} เพราะไม่มีคน`);
        } else {
          if (socket.id === room.hostId) {
            room.hostId = room.players[0].id; // ยกคนแรกเป็น Host
          }
          io.to(roomCode).emit('updatePlayerList', {
            players: room.players,
            hostId: room.hostId,
          });
        }
      }
    }
  });
});

// === ฟังก์ชันช่วย ===

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7);
}

function assignRoles(room) {
  const locations = [
    "ห้างสรรพสินค้า", "สถานีตำรวจ", "โรงพยาบาล", "โรงแรม", "สนามบิน", "เรือสำราญ",
    "สถานีอวกาศ", "สวนสนุก", "ชายหาด", "ร้านอาหาร", "ซูเปอร์มาร์เก็ต", "ค่ายทหาร",
    "โรงหนัง", "สนามกีฬา", "สวนสัตว์", "มหาวิทยาลัย", "ค่ายลูกเสือ", "ตลาดน้ำ",
    "พิพิธภัณฑ์", "วัด"
  ];
  const location = locations[Math.floor(Math.random() * locations.length)];

  const spyIndex = Math.floor(Math.random() * room.players.length);

  room.players.forEach((player, index) => {
    if (index === spyIndex) {
      player.role = 'spy';
      player.location = getFakeLocation(location); // สปายได้สถานที่หลอก
    } else {
      player.role = 'civilian';
      player.location = location;
    }
  });

  room.votes = {};
}

function getFakeLocation(realLocation) {
  const fakeLocations = [
    "โรงเรียน", "สนามบิน", "ห้าง", "ร้านอาหาร", "ชายหาด", "ตลาดสด",
    "ค่ายทหาร", "พิพิธภัณฑ์", "โรงหนัง", "มหาวิทยาลัย"
  ];
  let choice;
  do {
    choice = fakeLocations[Math.floor(Math.random() * fakeLocations.length)];
  } while (choice === realLocation);
  return choice;
}

function checkAllVotes(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;

  if (Object.keys(room.votes).length === room.players.length) {
    const voteCounts = {};
    Object.values(room.votes).forEach(id => {
      if (!voteCounts[id]) voteCounts[id] = 0;
      voteCounts[id]++;
    });

    const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const [targetId] = sorted[0];

    const targetPlayer = room.players.find(p => p.id === targetId);

    let spyWin = false;

    if (targetPlayer && targetPlayer.role === 'spy') {
      room.players.forEach(player => {
        if (player.role === 'civilian') player.score += 1;
      });
    } else {
      const spy = room.players.find(p => p.role === 'spy');
      if (spy) spy.score += 2;
      spyWin = true;
    }

    io.to(roomCode).emit('roundEnded', {
      spyWin,
      players: room.players,
      spyId: room.players.find(p => p.role === 'spy')?.id
    });

    room.started = false;
  }
}

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
