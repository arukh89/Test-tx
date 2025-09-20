/* === TX BATTLE ROYALE - FARCASTER MINIAPP === */

// Global game state
let gameState = {
  blockHeight: 0,
  isRoundActive: false,
  players: [],
  currentUser: {
    fid: null,
    username: null,
    prediction: null,
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
    // Check if running in Farcaster environment
    if (typeof window !== 'undefined' && window.parent !== window) {
      console.log('📱 Running inside Farcaster client');
    }
    
    // Import Farcaster SDK with better error handling
    let sdk;
    try {
      const farcasterModule = await import('@farcaster/miniapp-sdk');
      sdk = farcasterModule.sdk;
      window.farcasterSDK = sdk;
      console.log('✅ SDK imported successfully');
    } catch (importError) {
      console.error('❌ Failed to import SDK:', importError);
      // Fallback for development/testing
      continueAnonymous();
      return;
    }
    
    // Get user context first (before calling ready)
    try {
      const context = await sdk.context.get();
      console.log('📝 Context received:', context);
      
      if (context?.user) {
        gameState.currentUser.fid = context.user.fid;
        gameState.currentUser.username = context.user.username || context.user.displayName || `user${context.user.fid}`;
        
        updateUserDisplay();
        addChatMessage('System', `@${gameState.currentUser.username} joined the battle! 🎯`, 'system');
        console.log(`✅ User authenticated: @${gameState.currentUser.username} (FID: ${gameState.currentUser.fid})`);
      } else {
        // Anonymous mode
        gameState.currentUser.fid = generateAnonymousId();
        gameState.currentUser.username = 'Anonymous';
        addChatMessage('System', 'Anonymous player joined the battle! 👤', 'system');
        console.log('👤 Running in anonymous mode');
      }
    } catch (contextError) {
      console.warn('⚠️ Failed to get user context:', contextError);
      gameState.currentUser.fid = generateAnonymousId();
      gameState.currentUser.username = 'Anonymous';
    }
    
    // Initialize game components BEFORE calling ready
    console.log('🎮 Initializing game components...');
    await initializeGameComponents();
    
    // CRITICAL: Call ready() only after everything is fully loaded
    console.log('📢 Calling sdk.actions.ready()...');
    await sdk.actions.ready();
    gameState.isSDKReady = true;
    console.log('✅ Farcaster SDK ready() called successfully!');
    
    // Now show the app
    hideLoadingScreen();
    
    // Start the full game initialization
    await initializeGame();
    
  } catch (error) {
    console.error('❌ Failed to initialize Farcaster SDK:', error);
    handleSDKError(error);
  }
}

async function initializeGameComponents() {
  // Pre-load essential components before calling ready()
  console.log('🔧 Pre-loading game components...');
  
  // Setup critical UI elements
  setupEventListeners();
  
  // Load any saved state
  loadGameState();
  
  // Initialize basic UI
  updateGameStats();
  
  // Add a small delay to ensure DOM is fully ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('✅ Game components pre-loaded');
}

function generateAnonymousId() {
  return 'anon_' + Math.random().toString(36).substr(2, 9);
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
  const loadingScreen = document.getElementById('loadingScreen');
  const container = document.querySelector('.container');
  
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
  
  if (container) {
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }
}

function handleSDKError(error) {
  console.error('SDK Error:', error);
  const errorScreen = document.getElementById('errorScreen');
  const errorMessage = document.getElementById('errorMessage');
  
  if (errorScreen) {
    errorScreen.classList.remove('hidden');
  }
  
  if (errorMessage) {
    errorMessage.textContent = `SDK Error: ${error.message}`;
  }
}

function continueAnonymous() {
  gameState.currentUser.fid = generateAnonymousId();
  gameState.currentUser.username = 'Anonymous';
  initializeGame();
  hideLoadingScreen();
  document.getElementById('errorScreen').classList.add('hidden');
}

/* === GAME INITIALIZATION === */
async function initializeGame() {
  console.log('🎮 Initializing game...');
  
  // Load saved state
  loadGameState();
  
  // Update UI
  updateGameStats();
  updatePlayersList();
  
  // Connect to Bitcoin network
  connectToBitcoinNetwork();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize chat
  addChatMessage('System', '🚀 TX Battle Royale initialized! Ready to predict Bitcoin block transactions!', 'system');
  
  updateGameStatus('🔄 Connecting to Bitcoin network...');
}

function setupEventListeners() {
  const predictionInput = document.getElementById('predictionInput');
  const submitButton = document.getElementById('submitPrediction');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');
  
  // Prediction submission
  if (submitButton) {
    submitButton.onclick = submitPrediction;
  }
  
  if (predictionInput) {
    predictionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitPrediction();
    });
  }
  
  // Chat functionality
  if (sendButton) {
    sendButton.onclick = sendChatMessage;
  }
  
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
}

/* === BITCOIN NETWORK CONNECTION === */
function connectToBitcoinNetwork() {
  console.log('🔗 Connecting to Bitcoin network via mempool.space...');
  
  try {
    if (gameState.websocket) {
      gameState.websocket.close();
    }
    
    gameState.websocket = new WebSocket('wss://mempool.space/api/v1/ws');
    
    gameState.websocket.onopen = () => {
      console.log('✅ Connected to Bitcoin network');
      updateGameStatus('🟢 Connected to Bitcoin network. Waiting for next block...');
      fetchCurrentBlockData();
    };
    
    gameState.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    gameState.websocket.onerror = (error) => {
      console.error('❌ Bitcoin network connection error:', error);
      updateGameStatus('❌ Connection error. Retrying in 5 seconds...');
      setTimeout(connectToBitcoinNetwork, 5000);
    };
    
    gameState.websocket.onclose = () => {
      console.log('📡 Bitcoin network connection closed. Reconnecting...');
      setTimeout(connectToBitcoinNetwork, 3000);
    };
    
  } catch (error) {
    console.error('❌ Failed to connect to Bitcoin network:', error);
    updateGameStatus('❌ Failed to connect to Bitcoin network');
  }
}

function handleWebSocketMessage(data) {
  if (data.block) {
    handleNewBlock(data.block);
  }
  
  if (data.mempoolInfo) {
    updateEstimatedTransactions(data.mempoolInfo.count || 'Unknown');
  }
  
  if (data.txCount) {
    updateEstimatedTransactions(data.txCount);
  }
}

async function fetchCurrentBlockData() {
  try {
    const response = await fetch('https://mempool.space/api/blocks/tip/height');
    const height = await response.text();
    
    gameState.blockHeight = parseInt(height);
    updateCurrentBlockHeight(height);
    
    // Get estimated transaction count from mempool
    const mempoolResponse = await fetch('https://mempool.space/api/mempool');
    const mempoolData = await mempoolResponse.json();
    updateEstimatedTransactions(mempoolData.count || 'Unknown');
    
  } catch (error) {
    console.error('Error fetching block data:', error);
  }
}

/* === GAME LOGIC === */
function submitPrediction() {
  const predictionInput = document.getElementById('predictionInput');
  const prediction = parseInt(predictionInput.value);
  
  // Validation
  if (!prediction || prediction < 1 || prediction > 10000) {
    alert('⚠️ Please enter a valid prediction between 1 and 10,000 transactions');
    return;
  }
  
  if (gameState.currentUser.prediction !== null) {
    alert('⚠️ You already made a prediction for this round!');
    return;
  }
  
  if (!gameState.isRoundActive) {
    gameState.isRoundActive = true;
  }
  
  // Record prediction
  gameState.currentUser.prediction = prediction;
  
  // Add to players list
  const playerEntry = {
    fid: gameState.currentUser.fid,
    username: gameState.currentUser.username,
    prediction: prediction,
    timestamp: Date.now()
  };
  
  // Remove any existing entry for this user
  gameState.players = gameState.players.filter(p => p.fid !== gameState.currentUser.fid);
  gameState.players.push(playerEntry);
  
  // Update UI
  predictionInput.disabled = true;
  const submitButton = document.getElementById('submitPrediction');
  if (submitButton) {
    submitButton.textContent = '✅ Prediction Locked';
    submitButton.disabled = true;
  }
  
  // Announce in chat
  const displayName = gameState.currentUser.username === 'Anonymous' ? 'Anonymous' : `@${gameState.currentUser.username}`;
  addChatMessage(displayName, `I predict ${prediction} transactions in the next Bitcoin block! 🎯`, 'prediction');
  
  updatePlayersList();
  updateGameStats();
  saveGameState();
  
  updateGameStatus(`🎯 Your prediction (${prediction} txs) has been locked! Waiting for next block...`);
}

function handleNewBlock(block) {
  if (!gameState.isRoundActive || gameState.players.length === 0) {
    updateGameStatus(`⛏️ Block ${block.height} mined with ${block.tx_count} transactions`);
    return;
  }
  
  console.log(`🎉 New block mined! Height: ${block.height}, Transactions: ${block.tx_count}`);
  
  const actualTxCount = block.tx_count;
  
  // Calculate results
  const results = gameState.players.map(player => {
    const difference = Math.abs(player.prediction - actualTxCount);
    return { ...player, difference, actualTxCount };
  }).sort((a, b) => a.difference - b.difference);
  
  // Determine winner
  const winner = results[0];
  
  // Update winner's stats if it's the current user
  if (winner.fid === gameState.currentUser.fid) {
    gameState.currentUser.wins++;
    gameState.currentUser.streak++;
  } else {
    gameState.currentUser.streak = 0;
  }
  
  // Announce results
  announceResults(block, winner, results);
  
  // Reset for next round
  setTimeout(() => {
    startNewRound();
  }, 10000);
}

function announceResults(block, winner, results) {
  const winnerName = winner.username === 'Anonymous' ? 'Anonymous' : `@${winner.username}`;
  
  // Update winner banner
  const winnerAnnouncement = document.getElementById('winnerAnnouncement');
  if (winnerAnnouncement) {
    winnerAnnouncement.innerHTML = `
      <div class="winner-content">
        <h3>🏆 Round ${gameState.round} Winner!</h3>
        <p><strong>${winnerName}</strong></p>
        <p>Prediction: ${winner.prediction} | Actual: ${winner.actualTxCount} | Difference: ${winner.difference}</p>
      </div>
    `;
    winnerAnnouncement.classList.remove('hidden');
  }
  
  // Chat announcements
  addChatMessage('System', `⛏️ Block ${block.height} mined with ${winner.actualTxCount} transactions!`, 'system');
  addChatMessage('System', `🏆 ${winnerName} wins Round ${gameState.round}! (Prediction: ${winner.prediction}, Difference: ${winner.difference})`, 'winner');
  
  // Show top 3
  if (results.length >= 2) {
    const second = results[1];
    const secondName = second.username === 'Anonymous' ? 'Anonymous' : `@${second.username}`;
    addChatMessage('System', `🥈 Second place: ${secondName} (Prediction: ${second.prediction}, Difference: ${second.difference})`, 'result');
  }
  
  if (results.length >= 3) {
    const third = results[2];
    const thirdName = third.username === 'Anonymous' ? 'Anonymous' : `@${third.username}`;
    addChatMessage('System', `🥉 Third place: ${thirdName} (Prediction: ${third.prediction}, Difference: ${third.difference})`, 'result');
  }
  
  updatePlayersList(results);
  createConfettiEffect();
}

function startNewRound() {
  gameState.round++;
  gameState.isRoundActive = false;
  gameState.players = [];
  gameState.currentUser.prediction = null;
  
  // Reset UI
  const predictionInput = document.getElementById('predictionInput');
  const submitButton = document.getElementById('submitPrediction');
  const winnerAnnouncement = document.getElementById('winnerAnnouncement');
  
  if (predictionInput) {
    predictionInput.value = '';
    predictionInput.disabled = false;
  }
  
  if (submitButton) {
    submitButton.innerHTML = '<span class="btn-text">Submit Prediction</span><span class="btn-icon">🚀</span>';
    submitButton.disabled = false;
  }
  
  if (winnerAnnouncement) {
    winnerAnnouncement.classList.add('hidden');
  }
  
  updatePlayersList();
  updateGameStats();
  saveGameState();
  
  addChatMessage('System', `🚀 Round ${gameState.round} started! Make your predictions now!`, 'system');
  updateGameStatus(`🎮 Round ${gameState.round} started! Make your prediction for the next Bitcoin block.`);
}

/* === UI UPDATES === */
function updateGameStats() {
  const roundNumber = document.getElementById('roundNumber');
  const playersCount = document.getElementById('playersCount');
  const userWins = document.getElementById('userWins');
  const winStreak = document.getElementById('winStreak');
  const participantCount = document.getElementById('participantCount');
  
  if (roundNumber) roundNumber.textContent = gameState.round;
  if (playersCount) playersCount.textContent = gameState.players.length;
  if (userWins) userWins.textContent = gameState.currentUser.wins;
  if (winStreak) winStreak.textContent = gameState.currentUser.streak;
  if (participantCount) participantCount.textContent = `${gameState.players.length} player${gameState.players.length !== 1 ? 's' : ''}`;
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
  
  playersList.innerHTML = playersToShow.map((player, index) => {
    const displayName = player.username === 'Anonymous' ? 'Anonymous' : `@${player.username}`;
    const isCurrentUser = player.fid === gameState.currentUser.fid ? ' (You)' : '';
    const medal = results && index < 3 ? ['🏆', '🥈', '🥉'][index] : '';
    const difference = results ? ` (diff: ${player.difference})` : '';
    
    return `
      <li class="player-item">
        <span class="player-name">${medal} ${displayName}${isCurrentUser}</span>
        <span class="player-prediction">${player.prediction} txs${difference}</span>
      </li>
    `;
  }).join('');
}

function updateGameStatus(message) {
  const gameStatus = document.getElementById('gameStatus');
  if (gameStatus) {
    gameStatus.textContent = message;
  }
}

function updateCurrentBlockHeight(height) {
  const currentBlockHeight = document.getElementById('currentBlockHeight');
  if (currentBlockHeight) {
    currentBlockHeight.textContent = height;
  }
}

function updateEstimatedTransactions(count) {
  const estimatedTxCount = document.getElementById('estimatedTxCount');
  if (estimatedTxCount) {
    estimatedTxCount.textContent = `~${count}`;
  }
}

/* === CHAT SYSTEM === */
function sendChatMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  
  if (!message || message.length > 200) {
    if (message.length > 200) alert('⚠️ Message too long (max 200 characters)');
    return;
  }
  
  const displayName = gameState.currentUser.username === 'Anonymous' ? 'Anonymous' : `@${gameState.currentUser.username}`;
  addChatMessage(displayName, message, 'user');
  chatInput.value = '';
}

function addChatMessage(username, message, type = 'user') {
  const chatContainer = document.getElementById('chatMessages');
  if (!chatContainer) return;
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message chat-${type}`;
  
  const colors = {
    system: '#76ff40',
    prediction: '#f7931a', 
    winner: '#ffd700',
    result: '#87ceeb',
    user: '#ffffff'
  };
  
  messageElement.innerHTML = `
    <div class="chat-header">
      <span class="chat-username" style="color: ${colors[type]}">${username}</span>
      <span class="chat-timestamp">${timestamp}</span>
    </div>
    <div class="chat-content">${escapeHtml(message)}</div>
  `;
  
  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  // Limit chat history
  while (chatContainer.children.length > 100) {
    chatContainer.removeChild(chatContainer.firstChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* === VISUAL EFFECTS === */
function createConfettiEffect() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  confetti.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; overflow: hidden; z-index: 9999;
  `;
  
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute; width: 8px; height: 8px;
      background: hsl(${Math.random() * 360}, 100%, 60%);
      border-radius: 50%;
      top: ${Math.random() * 100}%; left: ${Math.random() * 100}%;
      animation: confetti-fall ${2 + Math.random() * 2}s ease-out forwards;
    `;
    confetti.appendChild(particle);
  }
  
  document.body.appendChild(confetti);
  setTimeout(() => document.body.removeChild(confetti), 4000);
}

/* === STATE MANAGEMENT === */
function saveGameState() {
  try {
    const stateToSave = {
      round: gameState.round,
      userWins: gameState.currentUser.wins,
      userStreak: gameState.currentUser.streak
    };
    // Note: Not using localStorage per artifact restrictions
    console.log('Game state would be saved:', stateToSave);
  } catch (error) {
    console.error('Error saving game state:', error);
  }
}

function loadGameState() {
  try {
    // Note: Not using localStorage per artifact restrictions
    console.log('Game state would be loaded from storage');
  } catch (error) {
    console.error('Error loading game state:', error);
  }
}

/* === SOCIAL SHARING === */
function shareWin() {
  if (gameState.currentUser.wins === 0) {
    alert('🏆 Win a round first to share your victory!');
    return;
  }
  
  const shareData = {
    title: '🏆 TX Battle Royale Victory!',
    text: `I just won a Bitcoin transaction prediction battle! 🎯 Win streak: ${gameState.currentUser.streak} 🔥`,
    url: window.location.href
  };
  
  if (navigator.share && navigator.canShare(shareData)) {
    navigator.share(shareData);
  } else {
    copyToClipboard(`${shareData.text} ${shareData.url}`);
    alert('🎉 Victory message copied to clipboard!');
  }
}

function shareGame() {
  const shareData = {
    title: '🎯 Join TX Battle Royale!',
    text: 'Join me in predicting Bitcoin block transactions! Real-time competition on Farcaster 🚀',
    url: window.location.href
  };
  
  if (navigator.share && navigator.canShare(shareData)) {
    navigator.share(shareData);
  } else {
    copyToClipboard(`${shareData.text} ${shareData.url}`);
    alert('🔗 Game link copied to clipboard!');
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  