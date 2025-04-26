const socket = io();
let playerNameInput, roomIdInput, gameModeSelect, createRoomButton, joinRoomButton;
let playerList, showRoomId, showMode, startGameButton, newRoundButton, endGameButton;
let lobbyDiv, gameDiv, voteDiv, resultDiv, finalResultDiv;
let gameInfo, timer, voteOptions, voteTimer, resultMessage, winnerName, winnerScore;

document.addEventListener('DOMContentLoaded', () => {
  playerNameInput = document.getElementById('playerName');
  roomIdInput = document.getElementById('roomId');
  gameModeSelect = document.getElementById('gameMode');
  createRoomButton = document.getElementById('createRoom');
  joinRoomButton = document.getElementById('joinRoom');
  playerList = document.getElementById('playerList');
  showRoomId = document.getElementById('showRoomId');
  showMode = document.getElementById('showMode');
  startGameButton = document.getElementById('startGame');
  newRoundButton = document.getElementById('newRound');
  endGameButton = document.getElementById('endGame');
  lobbyDiv = document.getElementById('lobby');
  gameDiv = document.getElementById('game');
  voteDiv = document.getElementById('vote');
  resultDiv = document.getElementById('result');
  finalResultDiv = document.getElementById('finalResult');
  gameInfo = document.getElementById('gameInfo');
  timer = document.getElementById('timer');
  voteOptions = document.getElementById('voteOptions');
  voteTimer = document.getElementById('voteTimer');
  resultMessage = document.getElementById('resultMessage');
  winnerName = document.getElementById('winnerName');
  winnerScore = document.getElementById('winnerScore');

  createRoomButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const mode = gameModeSelect.value;
    if (name) {
      socket.emit('createRoom', { name, mode });
    }
  });

  joinRoomButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    if (name && roomId) {
      socket.emit('joinRoom', { name, roomId });
    }
  });

  startGameButton.addEventListener('click', () => {
    socket.emit('startGame');
    startGameButton.disabled = true;
  });

  newRoundButton.addEventListener('click', () => {
    socket.emit('startNewRound');
    newRoundButton.disabled = true;
  });

  endGameButton.addEventListener('click', () => {
    socket.emit('endGame');
  });
});

socket.on('roomCreated', ({ roomId, players, mode }) => {
  document.getElementById('menu').style.display = 'none';
  lobbyDiv.style.display = 'block';
  showRoomId.textContent = roomId;
  showMode.textContent = mode === 'classic' ? 'Classic Mode (8 นาที)' : 'โหมดสายฟ้า (3 คำ x 2 รอบ)';
  updatePlayerList(players);
  try { localStorage.setItem('roomId', roomId); } catch (e) {}
});

socket.on('roomJoined', ({ roomId, players, mode }) => {
  document.getElementById('menu').style.display = 'none';
  lobbyDiv.style.display = 'block';
  showRoomId.textContent = roomId;
  showMode.textContent = mode === 'classic' ? 'Classic Mode (8 นาที)' : 'โหมดสายฟ้า (3 คำ x 2 รอบ)';
  updatePlayerList(players);
});

socket.on('updatePlayers', ({ players, hostId }) => {
  updatePlayerList(players, hostId);
});

socket.on('gameStarted', ({ role, location, mode }) => {
  lobbyDiv.style.display = 'none';
  gameDiv.style.display = 'block';
  gameInfo.textContent = role === 'spy' ? "คุณคือสปาย! หาทางเอาตัวรอด!" : `สถานที่: ${location}`;
  startCountdown(mode === 'classic' ? 480 : 90); // 8 นาที หรือ 90 วิ
});

socket.on('startVoting', ({ players }) => {
  gameDiv.style.display = 'none';
  voteDiv.style.display = 'block';
  voteOptions.innerHTML = '';
  players.forEach(player => {
    const btn = document.createElement('button');
    btn.textContent = player.name;
    btn.onclick = () => socket.emit('vote', player.id);
    voteOptions.appendChild(btn);
  });
  startVoteCountdown(30);
});

socket.on('votingResult', ({ result }) => {
  voteDiv.style.display = 'none';
  resultDiv.style.display = 'block';
  resultMessage.textContent = result;
});

socket.on('showFinalResult', ({ winner, score }) => {
  resultDiv.style.display = 'none';
  finalResultDiv.style.display = 'block';
  winnerName.textContent = `ผู้ชนะ: ${winner}`;
  winnerScore.textContent = `คะแนน: ${score}`;
});

function updatePlayerList(players, hostId) {
  playerList.innerHTML = '';
  players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = `${player.name} (${player.score} คะแนน) ${player.id === hostId ? '(Host)' : ''}`;
    playerList.appendChild(li);
  });
  const currentId = socket.id;
  const isHost = players.find(p => p.id === currentId && p.id === hostId);
  if (isHost) {
    startGameButton.style.display = 'inline-block';
    endGameButton.style.display = 'inline-block';
  }
}

function startCountdown(seconds) {
  timer.textContent = formatTime(seconds);
  const interval = setInterval(() => {
    seconds--;
    timer.textContent = formatTime(seconds);
    if (seconds <= 0) clearInterval(interval);
  }, 1000);
}

function startVoteCountdown(seconds) {
  voteTimer.textContent = `เวลาที่เหลือ: ${seconds} วินาที`;
  const interval = setInterval(() => {
    seconds--;
    voteTimer.textContent = `เวลาที่เหลือ: ${seconds} วินาที`;
    if (seconds <= 0) clearInterval(interval);
  }, 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
