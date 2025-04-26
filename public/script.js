const socket = io();

let roomCode = '';
let playerName = '';
let isHost = false;
let selectedMode = 'normal'; // 'normal' = 8 นาที, 'fast' = โหมดสายฟ้า
let players = [];
let myId = '';

document.getElementById('createRoomBtn').addEventListener('click', () => {
  playerName = document.getElementById('nameInput').value.trim();
  selectedMode = document.getElementById('modeSelect').value;
  if (playerName) {
    socket.emit('createRoom', { playerName, gameMode: selectedMode });
  }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  roomCode = document.getElementById('joinRoomInput').value.trim();
  playerName = document.getElementById('nameInput').value.trim();
  if (roomCode && playerName) {
    socket.emit('joinRoom', { roomCode, playerName });
  }
});

document.getElementById('startGameBtn').addEventListener('click', () => {
  if (isHost && roomCode) {
    socket.emit('startGame', { roomCode });
    document.getElementById('startGameBtn').disabled = true; // ล็อกปุ่ม
  }
});

// ฟังก์ชันอัปเดตรายชื่อผู้เล่น
function updatePlayerList(players, hostId) {
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name + (p.id === hostId ? ' (Host)' : '');
    list.appendChild(li);
  });
}

socket.on('roomCreated', (data) => {
  roomCode = data.roomCode;
  isHost = true;
  myId = socket.id;
  showLobby();
});

socket.on('joinSuccess', (data) => {
  roomCode = data.roomCode;
  isHost = false;
  myId = socket.id;
  showLobby();
});

socket.on('joinFailed', () => {
  alert('เข้าห้องไม่สำเร็จ กรุณาตรวจสอบรหัสห้องหรือลองใหม่');
});

socket.on('updatePlayerList', (data) => {
  players = data.players;
  isHost = data.hostId === socket.id;
  updatePlayerList(players, data.hostId);

  // ถ้าไม่ใช่ Host ให้ปิดปุ่ม Start
  document.getElementById('startGameBtn').disabled = !isHost;
});

socket.on('gameStarted', (data) => {
  const me = data.players.find(p => p.id === socket.id);
  if (!me) return;

  const roleText = me.role === 'spy' ? 'คุณคือ สปาย 🕵️‍♂️' : 'คุณคือ ผู้บริสุทธิ์ ✅';
  const locationText = `สถานที่ของคุณ: ${me.location}`;

  document.getElementById('lobbySection').style.display = 'none';
  document.getElementById('gameSection').style.display = 'block';

  document.getElementById('roleDisplay').innerHTML = `
    <h2>${roleText}</h2>
    <p>${locationText}</p>
  `;

  if (data.gameMode === 'normal') {
    startNormalMode();
  } else {
    startFastMode();
  }
});

// ---- ระบบโหมด ----

function startNormalMode() {
  document.getElementById('fastModeSection').style.display = 'none';
  document.getElementById('normalModeSection').style.display = 'block';

  let seconds = 480;
  const timer = document.getElementById('normalTimer');
  timer.textContent = `เหลือเวลา ${seconds} วินาที`;

  const interval = setInterval(() => {
    seconds--;
    timer.textContent = `เหลือเวลา ${seconds} วินาที`;
    if (seconds <= 0) {
      clearInterval(interval);
      showVoting();
    }
  }, 1000);
}

function startFastMode() {
  document.getElementById('normalModeSection').style.display = 'none';
  document.getElementById('fastModeSection').style.display = 'block';

  const fastText = document.getElementById('fastText');
  let playerIndex = 0;
  let round = 1;

  function nextTurn() {
    if (round > 2) {
      showVoting();
      return;
    }
    if (playerIndex >= players.length) {
      playerIndex = 0;
      round++;
      nextTurn();
      return;
    }
    fastText.textContent = `คนต่อไป: ${players[playerIndex].name} - พูด 3 คำ!`;
    playerIndex++;
  }

  nextTurn();

  document.getElementById('nextFastTurnBtn').addEventListener('click', () => {
    nextTurn();
  });
}

// ---- ระบบโหวต ----

function showVoting() {
  document.getElementById('normalModeSection').style.display = 'none';
  document.getElementById('fastModeSection').style.display = 'none';
  document.getElementById('votingSection').style.display = 'block';

  const votingList = document.getElementById('votingList');
  votingList.innerHTML = '';
  players.forEach(p => {
    if (p.id !== socket.id) { // ห้ามโหวตตัวเอง
      const btn = document.createElement('button');
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        socket.emit('submitVote', { roomCode, targetId: p.id });
      });
      votingList.appendChild(btn);
    }
  });

  let seconds = 30;
  const timer = document.getElementById('votingTimer');
  timer.textContent = `เหลือเวลาโหวต ${seconds} วินาที`;

  const interval = setInterval(() => {
    seconds--;
    timer.textContent = `เหลือเวลาโหวต ${seconds} วินาที`;
    if (seconds <= 0) {
      clearInterval(interval);
    }
  }, 1000);
}

socket.on('roundEnded', (data) => {
  document.getElementById('votingSection').style.display = 'none';
  document.getElementById('endSection').style.display = 'block';

  const spyName = players.find(p => p.id === data.spyId)?.name || 'ไม่พบ';
  const resultText = data.spyWin ? `สปายชนะ! คือ ${spyName}` : `สปายแพ้! (${spyName})`;

  document.getElementById('resultDisplay').innerHTML = `
    <h2>${resultText}</h2>
    <h3>สรุปคะแนน</h3>
    <ul>
      ${data.players.map(p => `<li>${p.name}: ${p.score} คะแนน</li>`).join('')}
    </ul>
  `;
});
