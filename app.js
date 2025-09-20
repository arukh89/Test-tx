/* === TX BATTLE ROYALE - FARCASTER MINIAPP === */

// Global game state
let gameState = {
  blockHeight: 0,
  isRoundActive: false,
  players: [],
  currentUser: {
    fid: null,
    username: null,
    guess: null,
    wins: 0,
    streak: 0
  },
  round: 1,
  websocket: null,
  isSDKReady: false
};

/* === FARCASTER SDK INITIALIZATION === */
async function initializeFarcasterSDK() {
  console.log('🚀 Initializing Farcaster MiniApp...');

  try {
    const farcasterModule = await import('@farcaster/miniapp-sdk');
    const sdk = farcasterModule.sdk;
    window.farcasterSDK = sdk;

    let context;
    try {
      context = await sdk.context.get();
    } catch (err) {
      console.warn('⚠️ No user context, fallback to anonymous');
    }

    if (context?.user) {
      gameState.currentUser.fid = context.user.fid;
      gameState.currentUser.username =
        context.user.username || context.user.displayName || `user${context.user.fid}`;

      updateUserDisplay();
      addChatMessage('System', `@${gameState.currentUser.username} joined the battle! 🎯`, 'system');
    } else {
      continueAnonymous();
    }

    await initializeGameComponents();
    await sdk.actions.ready();
    gameState.isSDKReady = true;

    hideLoadingScreen();
    await initializeGame();

  } catch (error) {
    console.error('❌ Failed to initialize Farcaster SDK:', error);
    handleSDKError(error);
  }
}

function generateAnonymousId() {
  return 'anon_' + Math.random().toString(36).substr(2, 9);
}

function continueAnonymous() {
  gameState.currentUser.fid = generateAnonymousId();
  gameState.currentUser.username = 'Anonymous';
  addChatMessage('System', 'Anonymous player joined the battle! 👤', 'system');
  initializeGame();
  hideLoadingScreen();
}

function updateUserDisplay() {
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const userFid = document.getElementById('userFid');

  if (userInfo && userName && userFid) {
    userName.textContent = gameState.currentUser.username;
    userFid.textContent = gameState.currentUser.fid;
    userInfo.style.display = 'block';
  }
}

function hideLoadingScreen() {
  document.getElementById('loadingScreen')?.classList.add('hidden');
  const container = document.querySelector('.container');
  if (container) {
    container.classList.remove('hidden');
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }
}

function handleSDKError(error) {
  const errorScreen = document.getElementById('errorScreen');
  const errorMessage = document.getElementById('errorMessage');

  if (errorScreen) errorScreen.classList.remove('hidden');
  if (errorMessage) errorMessage.textContent = `SDK Error: ${error.message}`;
}

/* === GAME INITIALIZATION === */
async function initializeGameComponents() {
  setupEventListeners();
  loadGameState();
  updateGameStats();
  await new Promise(res => setTimeout(res, 100));
}

async function initializeGame() {
  loadGameState();
  updateGameStats();
  updatePlayersList();
  connectToBitcoinNetwork();
  addChatMessage('System', '🚀 TX Battle Royale initialized!', 'system');
  updateGameStatus('🔄 Connecting to Bitcoin network...');
}

/* === EVENT LISTENERS === */
function setupEventListeners() {
  const predictionInput = document.getElementById('predictionInput');
  const submitButton = document.getElementById('submitPrediction');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');

  if (submitButton) submitButton.onclick = submitGuess;
  if (predictionInput) {
    predictionInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') submitGuess();
    });
  }
  if (sendButton) sendButton.onclick = sendChatMessage;
  if (chatInput) {
    chatInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
}

/* === BITCOIN CONNECTION === */
function connectToBitcoinNetwork() {
  if (gameState.websocket) gameState.websocket.close();

  gameState.websocket = new WebSocket('wss://mempool.space/api/v1/ws');

  gameState.websocket.onopen = () => {
    updateGameStatus('🟢 Connected to Bitcoin network. Waiting for next block...');
    fetchCurrentBlock();
  };

  gameState.websocket.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      handleWebSocketMessage(data);
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  };

  gameState.websocket.onerror = () => {
    updateGameStatus('❌ Connection error. Retrying...');
    setTimeout(connectToBitcoinNetwork, 5000);
  };

  gameState.websocket.onclose = () => {
    console.log('📡 Connection closed. Reconnecting...');
    setTimeout(connectToBitcoinNetwork, 3000);
  };
}

function handleWebSocketMessage(data) {
  if (data.block) handleNewBlock(data.block);
  if (data.mempoolInfo) updateEstimatedTransactions(data.mempoolInfo.count || 'Unknown');
  if (data.txCount) updateEstimatedTransactions(data.txCount);
}

/* === BLOCK EXPLORER EXTRA FUNCTIONS === */
async function fetchBlockByHeight(height) {
  try {
    const block = await (await fetch(`https://mempool.space/api/block/${height}`)).json();
    const txCount = block.tx_count || "Unknown";

    updateCurrentBlockHeight(block.height);
    updateEstimatedTransactions(txCount);
    gameState.blockHeight = block.height;

    addChatMessage("System", `🔍 Viewed block ${block.height} (${txCount} txs)`, "system");
  } catch (err) {
    console.error("Error fetching block:", err);
    updateGameStatus("❌ Failed to fetch block data");
  }
}

async function fetchCurrentBlock() {
  try {
    const height = await (await fetch("https://mempool.space/api/blocks/tip/height")).text();
    await fetchBlockByHeight(height);
  } catch (err) {
    console.error("Error fetching current block:", err);
  }
}

async function fetchPreviousBlock() {
  if (!gameState.blockHeight || gameState.blockHeight <= 1) {
    alert("⚠️ No previous block available");
    return;
  }
  await fetchBlockByHeight(gameState.blockHeight - 1);
}

async function fetchNextBlock() {
  if (!gameState.blockHeight) {
    alert("⚠️ No block data yet");
    return;
  }
  await fetchBlockByHeight(gameState.blockHeight + 1);
}

/* === GAME LOGIC === */
function submitGuess() {
  const predictionInput = document.getElementById('predictionInput');
  const guess = parseInt(predictionInput.value);

  if (!guess || guess < 1 || guess > 10000) {
    alert('⚠️ Enter a valid guess between 1 and 10,000 transactions');
    return;
  }
  if (gameState.currentUser.guess !== null) {
    alert('⚠️ You already guessed this round!');
    return;
  }

  gameState.currentUser.guess = guess;
  gameState.isRoundActive = true;

  gameState.players = gameState.players.filter(p => p.fid !== gameState.currentUser.fid);
  gameState.players.push({
    fid: gameState.currentUser.fid,
    username: gameState.currentUser.username,
    guess,
    timestamp: Date.now()
  });

  predictionInput.disabled = true;
  document.getElementById('submitPrediction').textContent = '✅ Guess Locked';
  document.getElementById('submitPrediction').disabled = true;

  addChatMessage(`@${gameState.currentUser.username}`, `I guess ${guess} txs 🎯`, 'guess');
  updatePlayersList();
  updateGameStats();
  saveGameState();
  updateGameStatus(`🎯 Your guess (${guess}) is locked. Waiting for next block...`);
}

function handleNewBlock(block) {
  if (!gameState.isRoundActive || gameState.players.length === 0) {
    updateGameStatus(`⛏️ Block ${block.height} mined with ${block.tx_count} txs`);
    return;
  }

  const actualTxCount = block.tx_count;
  const results = gameState.players.map(p => ({
    ...p,
    difference: Math.abs(p.guess - actualTxCount),
    actualTxCount
  })).sort((a, b) => a.difference - b.difference);

  const winner = results[0];

  if (winner.fid === gameState.currentUser.fid) {
    gameState.currentUser.wins++;
    gameState.currentUser.streak++;
  } else {
    gameState.currentUser.streak = 0;
  }

  announceResults(block, winner, results);
  setTimeout(startNewRound, 10000);
}

function announceResults(block, winner, results) {
  const winnerAnnouncement = document.getElementById('winnerAnnouncement');
  if (winnerAnnouncement) {
    winnerAnnouncement.innerHTML = `
      <div>
        <h3>🏆 Round ${gameState.round} Winner!</h3>
        <p><strong>@${winner.username}</strong></p>
        <p>Guess: ${winner.guess} | Actual: ${winner.actualTxCount} | Diff: ${winner.difference}</p>
      </div>
    `;
    winnerAnnouncement.classList.remove('hidden');
  }

  addChatMessage('System', `⛏️ Block ${block.height} had ${winner.actualTxCount} txs`, 'system');
  addChatMessage('System', `🏆 @${winner.username} wins Round ${gameState.round}!`, 'winner');

  if (results[1]) addChatMessage('System', `🥈 @${results[1].username} (${results[1].guess})`, 'result');
  if (results[2]) addChatMessage('System', `🥉 @${results[2].username} (${results[2].guess})`, 'result');

  updatePlayersList(results);
  createConfettiEffect();
}

function startNewRound() {
  gameState.round++;
  gameState.isRoundActive = false;
  gameState.players = [];
  gameState.currentUser.guess = null;

  document.getElementById('predictionInput').value = '';
  document.getElementById('predictionInput').disabled = false;
  document.getElementById('submitPrediction').innerHTML = 'Submit Prediction 🚀';
  document.getElementById('submitPrediction').disabled = false;
  document.getElementById('winnerAnnouncement').classList.add('hidden');

  updatePlayersList();
  updateGameStats();
  saveGameState();
  addChatMessage('System', `🚀 Round ${gameState.round} started!`, 'system');
  updateGameStatus(`🎮 Round ${gameState.round} started. Make your guess!`);
}

/* === UI UPDATES === */
function updateGameStats() {
  document.getElementById('roundNumber').textContent = gameState.round;
  document.getElementById('playersCount').textContent = gameState.players.length;
  document.getElementById('userWins').textContent = gameState.currentUser.wins;
  document.getElementById('winStreak').textContent = gameState.currentUser.streak;
  document.getElementById('participantCount').textContent = `${gameState.players.length} players`;
}

function updatePlayersList(results = null) {
  const playersList = document.getElementById('playersList');
  const emptyPlayers = document.getElementById('emptyPlayers');
  if (!playersList) return;

  const playersToShow = results || gameState.players;
  if (playersToShow.length === 0) {
    playersList.innerHTML = '';
    if (emptyPlayers) emptyPlayers.style.display = 'block';
    return;
  }
  if (emptyPlayers) emptyPlayers.style.display = 'none';

  playersList.innerHTML = playersToShow.map((p, i) => {
    const medal = results && i < 3 ? ['🏆','🥈','🥉'][i] : '';
    return `
      <li>
        <span>${medal} @${p.username}${p.fid===gameState.currentUser.fid?' (You)':''}</span>
        <span>${p.guess} txs${results?` (diff: ${p.difference})`:''}</span>
      </li>
    `;
  }).join('');
}

function updateGameStatus(msg) {
  document.getElementById('gameStatus').textContent = msg;
}

function updateCurrentBlockHeight(h) {
  document.getElementById('currentBlockHeight').textContent = h;
}

function updateEstimatedTransactions(c) {
  document.getElementById('estimatedTxCount').textContent = `~${c}`;
}

/* === CHAT SYSTEM === */
function sendChatMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (!message) return;

  addChatMessage(`@${gameState.currentUser.username}`, message, 'user');
  chatInput.value = '';
}

function addChatMessage(username, message, type = 'user') {
  const chatContainer = document.getElementById('chatMessages');
  if (!chatContainer) return;

  const timestamp = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message chat-message-${type}`;

  messageElement.innerHTML = `
    <div><span class="chat-name">${username}</span> <span class="chat-time">${timestamp}</span></div>
    <div class="chat-text">${escapeHtml(message)}</div>
  `;

  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  while (chatContainer.children.length > 100) {
    chatContainer.removeChild(chatContainer.firstChild);
  }
}

function escapeHtml(t) {
  const div = document.createElement('div');
  div.textContent = t;
  return div.innerHTML;
}

/* === VISUALS === */
function createConfettiEffect() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  for (let i=0;i<50;i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position:absolute;width:8px;height:8px;
      background:hsl(${Math.random()*360},100%,60%);
      border-radius:50%;
      top:${Math.random()*100}%;left:${Math.random()*100}%;
      animation:confetti-fall ${2+Math.random()*2}s ease-out forwards;
    `;
    confetti.appendChild(particle);
  }
  document.body.appendChild(confetti);
  setTimeout(()=>document.body.removeChild(confetti),4000);
}

/* === STORAGE === */
function saveGameState() {
  try {
    localStorage.setItem('txBattleState', JSON.stringify({
      round: gameState.round,
      wins: gameState.currentUser.wins,
      streak: gameState.currentUser.streak
    }));
  } catch(e) { console.warn('Save failed', e); }
}

function loadGameState() {
  try {
    const saved = localStorage.getItem('txBattleState');
    if (saved) {
      const s = JSON.parse(saved);
      gameState.round = s.round || 1;
      gameState.currentUser.wins = s.wins || 0;
      gameState.currentUser.streak = s.streak || 0;
    }
  } catch(e) { console.warn('Load failed', e); }
}

/* === SOCIAL SHARING === */
function shareWin() {
  if (gameState.currentUser.wins===0) {
    alert('Win a round first!');
    return;
  }
  const shareData = {
    title:'🏆 TX Battle Royale',
    text:`I just won a Bitcoin tx prediction! Streak: ${gameState.currentUser.streak} 🔥`,
    url:window.location.href
  };
  if (navigator.share) navigator.share(shareData);
  else copyToClipboard(`${shareData.text} ${shareData.url}`);
}

function shareGame() {
  const shareData = {
    title:'🎯 TX Battle Royale',
    text:'Join me predicting Bitcoin blocks on Farcaster!',
    url:window.location.href
  };
  if (navigator.share) navigator.share(shareData);
  else copyToClipboard(`${shareData.text} ${shareData.url}`);
}

function copyToClipboard(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
    }
  
