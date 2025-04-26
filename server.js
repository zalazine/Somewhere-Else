const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const locations = [
  "ห้างสรรพสินค้า", "สนามบิน", "โรงเรียน", "โรงพยาบาล", "สถานีตำรวจ",
  "ชายหาด", "โรงแรม", "สวนสัตว์", "สถานีรถไฟ", "โรงภาพยนตร์",
  "ค่ายทหาร", "เรือสำราญ", "คาสิโน", "ร้านอาหาร", "ออฟฟิศ",
  "สวนสนุก", "สนามกีฬา", "ห้องสมุด", "พิพิธภัณฑ์", "คลับกลางคืน"
];

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 5);
}

io.on('connection', (socket) => {
  console.log('ผู้เล่นเชื่อมต่อ:', socket.id);

  socket.on('createRoom', ({ playerName, mode }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      host: socket.id,
      players: [{ id: socket.id, name: playerName, score: 0 }],
      started: false,
      mode: mode,
      votes: {},
      round: 1,
    };
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    io.to(roomCode).emit('updatePlayerList', rooms[roomCode].players, rooms[roomCode].host);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (room && !room.started) {
      room.players.push({ id: socket.id, name: playerName, score: 0 });
      socket.join(roomCode);
      io.to(roomCode).emit('updatePlayerList', room.players, room.host);
    } else {
      socket.emit('errorMessage', 'ไม่สามารถเข้าร่วมได้');
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      room.started = true;
      const location = locations[Math.floor(Math.random() * locations.length)];
      const spyIndex = Math.floor(Math.random() * room.players.length);
      room.location = location;
      room.spyId = room.players[spyIndex].id;
      room.players.forEach((player, index) => {
        if (index === spyIndex) {
          socket.to(player.id).emit('roleAssignment', { location: "(??? สถานที่ลับ ???)" });
        } else {
          socket.to(player.id).emit('roleAssignment', { location });
        }
      });

      io.to(roomCode).emit('gameStarted', { location: room.mode === 'normal' ? location : null, mode: room.mode });

      if (room.mode === 'normal') {
        setTimeout(() => {
          io.to(roomCode).emit('startVoting');
        }, 8 * 60 * 1000); // 8 นาที
      } else if (room.mode === 'lightning') {
        io.to(roomCode).emit('startLightningRound');
      }
    }
  });

  socket.on('endLightningRound', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      io.to(roomCode).emit('startVoting');
    }
  });

  socket.on('castVote', ({ roomCode, votedId }) => {
    const room = rooms[roomCode];
    if (room) {
      room.votes[socket.id] = votedId;
    }
  });

  socket.on('endVoting', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (room) {
      const voteCounts = {};
      Object.values(room.votes).forEach((votedId) => {
        voteCounts[votedId] = (voteCounts[votedId] || 0) + 1;
      });

      let mostVoted = null;
      let maxVotes = 0;
      for (const id in voteCounts) {
        if (voteCounts[id] > maxVotes) {
          mostVoted = id;
          maxVotes = voteCounts[id];
        }
      }

      let spyCaught = mostVoted === room.spyId;

      if (spyCaught) {
        // คนปกติชนะ
        room.players.forEach(player => {
          if (player.id !== room.spyId) {
            player.score += 1;
          }
        });
      } else {
        // สปายชนะ
        const spyPlayer = room.players.find(player => player.id === room.spyId);
        if (spyPlayer) {
          spyPlayer.score += 2;
        }
      }

      io.to(roomCode).emit('revealResult', {
        spyId: room.spyId,
        spyCaught,
        scores: room.players.map(player => ({ name: player.name, score: player.score })),
      });

      // Reset สำหรับรอบถัดไป
      room.started = false;
      room.votes = {};
    }
  });

  socket.on('disconnect', () => {
    console.log('ผู้เล่นหลุด:', socket.id);

    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);

        if (room.players.length === 0) {
          delete rooms[roomCode];
        } else {
          if (room.host === socket.id) {
            room.host = room.players[0].id;
          }
          io.to(roomCode).emit('updatePlayerList', room.players, room.host);
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
