document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const playerNameInput = document.getElementById('playerName');
  const roomIdInput = document.getElementById('roomId');
  const gameModeSelect = document.getElementById('gameMode');
  const menu = document.getElementById('menu');
  const lobby = document.getElementById('lobby');
  const showRoomId = document.getElementById('showRoomId');
  const showMode = document.getElementById('showMode');
  const playerList = document.getElementById('playerList');
  const startGameBtn = document.getElementById('startGame');
  const newRoundBtn = document.getElementById('newRound');
  const endGameBtn = document.getElementById('endGame');
  const game = document.getElementById('game');
  const gameInfo = document.getElementById('gameInfo');
  const timer = document.getElementById('timer');
  const vote = document.getElementById('vote');
  const voteOptions = document.getElementById('voteOptions');
  const voteTimer = document.getElementById('voteTimer');
  const result = document.getElementById('result');
  const resultMessage = document.getElementById('resultMessage');
  const finalResult = document.getElementById('finalResult');
  const winnerName = document.getElementById('winnerName');
  const winnerScore = document.getElementById('winnerScore');

  let myId = '';
  let isHost = false;
  let hasVoted = false;

  createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert('กรุณากรอกชื่อผู้เล่น');

    const mode = gameModeSelect.value;
    socket.emit('createRoom', { name, mode });
  });

  joinRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const room = roomIdInput.value.trim();
    if (!name || !room) return alert('กรุณากรอกชื่อและรหัสห้อง');

    socket.emit('joinRoom', { name, room });
  });

  startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
    startGameBtn.disabled = true;
  });

  newRoundBtn.addEventListener('click', () => {
    socket.emit('newRound');
    newRoundBtn.disabled = true;
  });

  endGameBtn.addEventListener('click', () => {
    socket.emit('endGame');
  });

  socket.on('roomCreated', ({ roomId, mode, players, id }) => {
    myId = id;
    isHost = true;
    menu.style.display = 'none';
    lobby.style.display = 'block';
    showRoomId.textContent = roomId;
    showMode.textContent = mode === 'classic' ? 'Classic Mode' : 'โหมดสายฟ้า';
    updatePlayerList(players);
    startGameBtn.style.display = 'inline-block';
  });

  socket.on('joinedRoom', ({ roomId, mode, players, id, hostId }) => {
    myId = id;
    isHost = (id === hostId);
    menu.style.display = 'none';
    lobby.style.display = 'block';
    showRoomId.textContent = roomId;
    showMode.textContent = mode === 'classic' ? 'Classic Mode' : 'โหมดสายฟ้า';
    updatePlayerList(players);
    startGameBtn.style.display = isHost ? 'inline-block' : 'none';
  });

  socket.on('updatePlayers', (players) => {
    updatePlayerList(players);
  });

  socket.on('gameStarted', ({ role, location, mode }) => {
    lobby.style.display = 'none';
    game.style.display = 'block';
    vote.style.display = 'none';
    result.style.display = 'none';
    finalResult.style.display = 'none';

    if (role === 'spy') {
      gameInfo.textContent = 'คุณคือ สปาย!';
    } else {
      gameInfo.textContent = `สถานที่คือ: ${location}`;
    }

    if (mode === 'classic') {
      startTimer(8 * 60, timer, () => socket.emit('startVoting'));
    } else {
      startTimer(60, timer, () => socket.emit('startLightningRound'));
    }
  });

  socket.on('lightningRound', () => {
    alert('โหมดสายฟ้า! พูดคำ 3 คำแบบรอบเวียน');
    socket.emit('startVoting');
  });

  socket.on('startVoting', (players) => {
    game.style.display = 'none';
    vote.style.display = 'block';
    result.style.display = 'none';
    finalResult.style.display = 'none';

    voteOptions.innerHTML = '';
    players.forEach(p => {
      if (p.id !== myId) {
        const btn = document.createElement('button');
        btn.textContent = p.name;
        btn.onclick = () => {
          if (!hasVoted) {
            socket.emit('vote', p.id);
            hasVoted = true;
          }
        };
        voteOptions.appendChild(btn);
      }
    });

    startTimer(30, voteTimer, () => {
      if (!hasVoted) socket.emit('vote', null);
    });
  });

  socket.on('voteResult', ({ spyCaught, winner, players }) => {
    vote.style.display = 'none';
    result.style.display = 'block';
    game.style.display = 'none';
    finalResult.style.display = 'none';

    if (spyCaught) {
      resultMessage.textContent = `✅ จับสปายได้! ผู้ชนะคือ: ${winner}`;
    } else {
      resultMessage.textContent = `❌ จับผิดตัว! สปายชนะ: ${winner}`;
    }

    if (isHost) {
      newRoundBtn.style.display = 'inline-block';
      endGameBtn.style.display = 'inline-block';
    }
  });

  socket.on('finalResult', ({ winner, score }) => {
    vote.style.display = 'none';
    result.style.display = 'none';
    game.style.display = 'none';
    lobby.style.display = 'none';
    finalResult.style.display = 'block';
    winnerName.textContent = `ผู้ชนะ: ${winner}`;
    winnerScore.textContent = `คะแนน: ${score} คะแนน`;
  });

  function updatePlayerList(players) {
    playerList.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.name} (${p.score} คะแนน)${p.isHost ? ' (Host)' : ''}`;
      playerList.appendChild(li);
    });
  }

  function startTimer(duration, display, callback) {
    let timer = duration, minutes, seconds;
    const interval = setInterval(() => {
      minutes = Math.floor(timer / 60);
      seconds = timer % 60;
      display.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      if (--timer < 0) {
        clearInterval(interval);
        callback();
      }
    }, 1000);
  }
});
