const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

const rooms = {};

const locations = [
  { real: "ร้านกาแฟ", fake: "ร้านเบเกอรี่" },
  { real: "สนามบิน", fake: "สถานีรถไฟ" },
  { real: "โรงหนัง", fake: "โรงละคร" },
  { real: "ชายหาด", fake: "สวนน้ำ" },
  { real: "โรงเรียน", fake: "มหาวิทยาลัย" },
  { real: "ห้างสรรพสินค้า", fake: "ตลาดนัด" },
  { real: "พิพิธภัณฑ์", fake: "หอศิลป์" },
  { real: "สวนสัตว์", fake: "สวนสาธารณะ" },
  { real: "โรงพยาบาล", fake: "คลินิกแพทย์" },
  { real: "ร้านอาหาร", fake: "ฟู้ดคอร์ท" },
  { real: "สนามกีฬา", fake: "ฟิตเนส" },
  { real: "เรือสำราญ", fake: "เรือเฟอร์รี่" },
  { real: "สตูดิโอถ่ายภาพ", fake: "ร้านถ่ายเอกสาร" },
  { real: "สวนสนุก", fake: "สวนน้ำ" },
  { real: "ไปรษณีย์", fake: "ร้านพัสดุ" },
  { real: "วัด", fake: "โบสถ์" },
  { real: "โรงแรม", fake: "โฮสเทล" },
  { real: "ร้านขายยา", fake: "ร้านสะดวกซื้อ" },
  { real: "สถานีตำรวจ", fake: "สำนักงานเขต" },
  { real: "ฟาร์มสัตว์", fake: "สวนเกษตร" }
];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-room', ({ playerName, mode }) => {
    const roomId = Math.random().toString(36).substr(2, 5);
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName, score: 0 }],
      hostId: socket.id,
      mode: mode,
      started: false,
      spyId: null,
      votes: {}
    };
    socket.join(roomId);
    socket.emit('room-created', { roomId, mode });
    updatePlayerList(roomId);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    if (rooms[roomId]) {
      rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });
      socket.join(roomId);
      socket.emit('room-joined', { roomId, mode: rooms[roomId].mode });
      updatePlayerList(roomId);
    } else {
      socket.emit('error-message', { message: 'ไม่พบห้องนี้!' });
    }
  });

  socket.on('start-game', ({ roomId }) => {
    startNewRound(roomId);
  });

  socket.on('new-round', ({ roomId }) => {
    startNewRound(roomId);
  });

  socket.on('submit-vote', ({ roomId, voterId, targetId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.votes[voterId] = targetId;

    if (Object.keys(room.votes).length === room.players.length) {
      calculateVotes(roomId);
    }
  });

  socket.on('end-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const topPlayer = [...room.players].sort((a, b) => b.score - a.score)[0];

    io.to(roomId).emit('game-ended', {
      winnerName: topPlayer ? topPlayer.name : "ไม่มีใคร",
      winnerScore: topPlayer ? topPlayer.score : 0
    });

    delete rooms[roomId];
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(player => player.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted (empty)`);
      } else {
        updatePlayerList(roomId);
      }
    }
  });
});

function updatePlayerList(roomId) {
  const room = rooms[roomId];
  if (room) {
    const players = room.players.map(p => ({ name: p.name, id: p.id, score: p.score }));
    io.to(roomId).emit('update-player-list', { players, hostId: room.hostId });
  }
}

function startNewRound(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length < 3) {
    io.to(roomId).emit('error-message', { message: 'ต้องมีอย่างน้อย 3 คนขึ้นไป!' });
    return;
  }

  room.started = true;
  room.votes = {};

  const location = locations[Math.floor(Math.random() * locations.length)];
  const spyIndex = Math.floor(Math.random() * room.players.length);
  room.spyId = room.players[spyIndex].id;

  room.players.forEach((player, index) => {
    const place = (index === spyIndex) ? location.fake : location.real;
    io.to(player.id).emit('receive-role', { place });
  });

  io.to(roomId).emit('game-started', { mode: room.mode, players: room.players });
}

function calculateVotes(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const tally = {};
  for (const voterId in room.votes) {
    const targetId = room.votes[voterId];
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  let maxVotes = 0;
  let votedId = null;
  for (const id in tally) {
    if (tally[id] > maxVotes) {
      maxVotes = tally[id];
      votedId = id;
    }
  }

  const spyCaught = votedId === room.spyId;

  if (spyCaught) {
    room.players.forEach(p => {
      if (p.id !== room.spyId) {
        p.score += 1; // คนปกติได้คนละ 1 คะแนน
      }
    });
  } else {
    const spy = room.players.find(p => p.id === room.spyId);
    if (spy) spy.score += 2; // สปายรอดได้ 2 คะแนน
  }

  updatePlayerList(roomId); // อัปเดตคะแนนใหม่ให้ทุกคน

  const votedPlayer = room.players.find(p => p.id === votedId);

  io.to(roomId).emit('vote-result', {
    votedName: votedPlayer ? votedPlayer.name : 'ไม่มีใคร',
    spyCaught: spyCaught,
    players: room.players
  });
}
