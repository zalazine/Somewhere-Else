const socket = io();
let currentRoomId = '';
let isHost = false;
let mySocketId = '';
let currentMode = 'classic';
let players = [];
let speakingOrder = [];
let currentRound = 1;
let currentSpeakerIndex = 0;
let maxRounds = 2;
let timerInterval = null;
let secondsLeft = 0;
let voteChoice = null;
let votingActive = false;

socket.on('connect', () => {
  mySocketId = socket.id;
});

document.getElementById('createRoom').addEventListener('click', () => {
  const playerName = document.getElementById('playerName').value.trim();
  const gameMode = document.getElementById('gameMode').value;
  if (playerName) {
    isHost = true;
    currentMode = gameMode;
    socket.emit('create-room', { playerName, mode: gameMode });
  } else {
    alert('กรุณากรอกชื่อผู้เล่น');
  }
});

document.getElementById('joinRoom').addEventListener('click', () => {
  const roomId = document.getElementById('roomId').value.trim();
  const playerName = document.getElementById('playerName').value.trim();
  if (roomId && playerName) {
    isHost = false;
    socket.emit('join-room', { roomId, playerName });
  } else {
    alert('กรุณากรอกชื่อผู้เล่นและรหัสห้อง');
  }
});

document.getElementById('startGame').addEventListener('click', () => {
  socket.emit('start-game', { roomId: currentRoomId });
  document.getElementById('startGame').disabled = true;
  document.getElementById('startGame').textContent = 'กำลังเริ่มเกม...';
});

document.getElementById('newRound').addEventListener('click', () => {
  socket.emit('new-round', { roomId: currentRoomId });
});

document.getElementById('endGame').addEventListener('click', () => {
  if (confirm('แน่ใจไหมที่จะจบเกม?')) {
    socket.emit('end-game', { roomId: currentRoomId });
  }
});

socket.on('room-created', ({ roomId, mode }) => {
  currentRoomId = roomId;
  currentMode = mode;
  enterLobby(roomId, mode);
});

socket.on('room-joined', ({ roomId, mode }) => {
  currentRoomId = roomId;
  currentMode = mode;
  enterLobby(roomId, mode);
});

socket.on('update-player-list', ({ players: playerList, hostId }) => {
  const playerListElem = document.getElementById('playerList');
  playerListElem.innerHTML = '';
  players = playerList;
  playerList.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name} (${player.score} คะแนน)`;
    if (player.id === hostId) {
      li.textContent += ' (Host)';
    }
    playerListElem.appendChild(li);
  });

  if (hostId === mySocketId) {
    document.getElementById('startGame').style.display = 'inline-block';
    document.getElementById('newRound').style.display = 'inline-block';
    document.getElementById('endGame').style.display = 'inline-block';
    document.getElementById('startGame').disabled = false;
    document.getElementById('startGame').textContent = 'เริ่มเกม';
  } else {
    document.getElementById('startGame').style.display = 'none';
    document.getElementById('newRound').style.display = 'none';
    document.getElementById('endGame').style.display = 'none';
  }
});

socket.on('receive-role', ({ place }) => {
  alert(`สถานที่ของคุณคือ: ${place}`);
});

socket.on('game-started', ({ mode, players: playerList }) => {
  players = playerList;
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'block';

  if (mode === 'classic') {
    startClassicMode();
  } else if (mode === 'lightning') {
    startLightningMode();
  }
});

socket.on('vote-result', ({ votedName, spyCaught, players: updatedPlayers }) => {
  players = updatedPlayers;
  document.getElementById('vote').style.display = 'none';
  document.getElementById('result').style.display = 'block';
  document.getElementById('resultMessage').textContent = spyCaught
    ? `จับได้สปาย! คือ ${votedName}! 🎯`
    : `จับผิดตัว... คนที่โดนโหวตคือ ${votedName} ❌`;
});

socket.on('game-ended', ({ winnerName, winnerScore }) => {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('game').style.display = 'none';
  document.getElementById('vote').style.display = 'none';
  document.getElementById('result').style.display = 'none';
  document.getElementById('finalResult').style.display = 'block';

  document.getElementById('winnerName').textContent = `ผู้ชนะคือ: ${winnerName}`;
  document.getElementById('winnerScore').textContent = `คะแนนรวม: ${winnerScore} คะแนน`;
});

socket.on('error-message', ({ message }) => {
  alert(`เกิดข้อผิดพลาด: ${message}`);
});

function enterLobby(roomId, mode) {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('lobby').style.display = 'block';
  document.getElementById('showRoomId').textContent = roomId;
  document.getElementById('showMode').textContent = (mode === 'lightning') ? 'โหมดสายฟ้า (3 คำ x 2 รอบ)' : 'Classic (8 นาที)';
}

function startClassicMode() {
  document.getElementById('gameInfo').textContent = 'เริ่มโหมด Classic! ถาม-ตอบได้อิสระ 8 นาที';
  secondsLeft = 8 * 60;
  timerInterval = setInterval(() => {
    updateTimer();
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      startVoting();
    }
  }, 1000);
}

function startLightningMode() {
  speakingOrder = players.slice();
  currentRound = 1;
  currentSpeakerIndex = 0;
  document.getElementById('gameInfo').textContent = `โหมดสายฟ้า! รอบที่ 1 คนพูด: ${speakingOrder[currentSpeakerIndex].name}`;
  secondsLeft = 10;
  timerInterval = setInterval(() => {
    updateTimerLightning();
  }, 1000);
}

function updateTimer() {
  if (secondsLeft > 0) {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    document.getElementById('timer').textContent = `เหลือเวลา: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    secondsLeft--;
  }
}

function updateTimerLightning() {
  if (secondsLeft > 0) {
    document.getElementById('timer').textContent = `เหลือเวลา: ${secondsLeft} วินาที`;
    secondsLeft--;
  } else {
    moveToNextSpeaker();
  }
}

function moveToNextSpeaker() {
  currentSpeakerIndex++;
  if (currentSpeakerIndex >= speakingOrder.length) {
    currentSpeakerIndex = 0;
    currentRound++;
  }

  if (currentRound > maxRounds) {
    clearInterval(timerInterval);
    startVoting();
    return;
  }

  document.getElementById('gameInfo').textContent = `โหมดสายฟ้า! รอบที่ ${currentRound} คนพูด: ${speakingOrder[currentSpeakerIndex].name}`;
  secondsLeft = 10;
}

function startVoting() {
  document.getElementById('game').style.display = 'none';
  document.getElementById('vote').style.display = 'block';
  votingActive = true;
  const voteOptions = document.getElementById('voteOptions');
  voteOptions.innerHTML = '';

  players.forEach(player => {
    if (player.id !== mySocketId) {
      const btn = document.createElement('button');
      btn.textContent = player.name;
      btn.onclick = () => selectVote(player.id, btn);
      voteOptions.appendChild(btn);
    }
  });

  secondsLeft = 30;
  timerInterval = setInterval(() => {
    document.getElementById('voteTimer').textContent = `เหลือเวลาโหวต: ${secondsLeft} วินาที`;
    secondsLeft--;
    if (secondsLeft < 0) {
      clearInterval(timerInterval);
      submitVote();
    }
  }, 1000);
}

function selectVote(playerId, button) {
  if (!votingActive) return;
  voteChoice = playerId;
  const buttons = document.querySelectorAll('#voteOptions button');
  buttons.forEach(btn => btn.style.background = '');
  button.style.background = '#d3d3d3';
}

function submitVote() {
  votingActive = false;
  if (voteChoice) {
    socket.emit('submit-vote', { roomId: currentRoomId, voterId: mySocketId, targetId: voteChoice });
  } else {
    socket.emit('submit-vote', { roomId: currentRoomId, voterId: mySocketId, targetId: null });
  }
}
