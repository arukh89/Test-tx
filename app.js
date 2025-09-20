/* --- GLOBAL VARIABLES --- */
let blockHeight = 0;
let locked = true;
let guesses = [];
let myGuess = null;
let myFid = null;
let myName = 'Anon';
let roundNumber = 1;
let userWins = 0;
let winStreak = 0;
let isSDKReady = false;

/* --- URL STATE MANAGEMENT --- */
function readHash() {
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    guesses = JSON.parse(p.get('g') || '[]');
    blockHeight = Number(p.get('h') || 0);
    roundNumber = Number(p.get('r') || 1);
  } catch (e) {
    console.warn('Failed to read hash state:', e);
  }
}

function pushHash() {
  try {
    const p = new URLSearchParams();
    p.set('g', JSON.stringify(guesses));
    p.set('h', blockHeight);
    p.set('r', roundNumber);
    location.hash = p.toString();
  } catch (e) {
    console.error('Failed to push hash state:', e);
  }
}

/* --- DOM HELPERS --- */
function byId(id) {
  return document.getElementById(id);
}

function renderPlayers() {
  const playersList = byId('playersList');
  const playersCount = byId('playersCount');
  const activePlayersCount = byId('activePlayersCount');
  
  if (playersList) {
    playersList.innerHTML = guesses.map((g, i) => {
      const isWinner = g.isWinner ? ' 🏆' : '';
      const isMe = g.fid === myFid ? ' (You)' : '';
      // Display username with @ symbol for better visibility
      const displayName = g.username ? `@${g.username}` : (g.name || `Player ${i + 1}`);
      return `<li>${displayName}: ${g.guess} txs${isWinner}${isMe}</li>`;
    }).join('');
  }
  
  if (playersCount) playersCount.textContent = guesses.length;
  if (activePlayersCount) activePlayersCount.textContent = guesses.length;
}

/* --- FARCASTER SDK INITIALIZATION --- */
async function initializeFarcasterSDK() {
  try {
    console.log('Initializing Farcaster MiniApp...');
    
    // Check if SDK is available
    if (typeof miniapp === 'undefined' || !miniapp.sdk) {
      throw new Error('Farcaster SDK not loaded');
    }
    
    // Initialize the SDK
    await miniapp.sdk.actions.ready();
    console.log('SDK ready');
    
    // Get user context if available
    try {
      const context = await miniapp.sdk.context.get();
      if (context && context.user) {
        myFid = context.user.fid;
        // Prioritize username over displayName for consistency
        myName = context.user.username || context.user.displayName || `user${myFid}`;
        
        // Update UI with user info
        const userInfo = byId('userInfo');
        const userName = byId('userName');
        const userFid = byId('userFid');
        
        if (userInfo && userName && userFid) {
          userName.textContent = myName;
          userFid.textContent = myFid;
          userInfo.style.display = 'block';
        }
        
        console.log(`User connected: ${myName} (FID: ${myFid})`);
        addChatMessage('System', `@${myName} joined the battle!`, 'system');
      } else {
        // Fallback if no user context
        myName = 'Anonymous';
        myFid = Math.random().toString(36).substr(2, 9); // Generate random ID for anonymous users
        console.log('No user context, using anonymous mode');
        addChatMessage('System', `Anonymous player joined the battle!`, 'system');
      }
    } catch (contextError) {
      console.log('No user context available, using anonymous mode:', contextError);
      myName = 'Anonymous';
      myFid = Math.random().toString(36).substr(2, 9);
      addChatMessage('System', `Anonymous player joined the battle!`, 'system');
    }
    
    isSDKReady = true;
    showMainContent();
    
  } catch (error) {
    console.error('Failed to initialize Farcaster SDK:', error);
    // Even if SDK fails, allow anonymous play
    myName = 'Anonymous';
    myFid = Math.random().toString(36).substr(2, 9);
    showMainContent();
  }
}

function showMainContent() {
  const loadingScreen = byId('loadingScreen');
  const container = document.querySelector('.container');
  
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
  
  if (container) {
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';
  }
  
  // Initialize the game
  initializeGame();
}

function showError(message) {
  const loadingScreen = byId('loadingScreen');
  const errorScreen = byId('errorScreen');
  
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
  
  if (errorScreen) {
    errorScreen.classList.remove('hidden');
    const errorContent = errorScreen.querySelector('p');
    if (errorContent) {
      errorContent.textContent = message;
    }
  }
}

/* --- GAME INITIALIZATION --- */
function initializeGame() {
  readHash();
  renderPlayers();
  connectToMempool();
  updateGameStats();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load current block data
  fetchCurrentBlock();
  
  byId('status').textContent = 'Ready to battle! Make your prediction.';
}

function setupEventListeners() {
  const lockBtn = byId('lockBtn');
  const chatInput = byId('chatInput');
  const guessInput = byId('guessInp');
  
  if (lockBtn) {
    lockBtn.onclick = lockGuess;
  }
  
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
  
  if (guessInput) {
    guessInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        lockGuess();
      }
    });
  }
}

/* --- GUESS LOGIC --- */
function lockGuess() {
  if (locked) {
    alert('Round locked. Wait for new block.');
    return;
  }
  
  if (myGuess) {
    alert('You already guessed!');
    return;
  }
  
  const guessInput = byId('guessInp');
  const val = Number(guessInput.value);
  
  if (!val || isNaN(val) || val < 1) {
    alert('Enter a positive number');
    return;
  }
  
  myGuess = val;
  guesses.push({ 
    fid: myFid, 
    name: myName,
    username: myName === 'Anonymous' ? null : myName, // Store username separately
    guess: val,
    timestamp: Date.now()
  });
  
  pushHash();
  renderPlayers();
  
  // Update UI
  guessInput.disabled = true;
  const lockBtn = byId('lockBtn');
  if (lockBtn) {
    lockBtn.textContent = 'Guess Locked ✅';
    lockBtn.disabled = true;
  }

  // Show guess in chat with proper username format
  const displayName = myName === 'Anonymous' ? 'Anonymous' : `@${myName}`;
  addChatMessage(displayName, `I predict ${val} transactions for the next BTC block! 🎯`, 'guess');
  byId('status').textContent = `Your guess (${val} txs) has been recorded. Waiting for next block...`;
}

/* --- WEBSOCKET FOR BLOCK DATA --- */
let ws;

function connectToMempool() {
  try {
    ws = new WebSocket('wss://mempool.space/api/v1/ws');
    
    ws.onopen = () => {
      console.log('Connected to mempool.space');
      byId('status').textContent = 'Connected to Bitcoin network. Waiting for block...';
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        
        if (data.block) {
          finishRound(data.block);
        }
        
        if (data.mempoolInfo) {
          const estimatedTx = byId('estimatedTx');
          if (estimatedTx) {
            estimatedTx.textContent = `~${data.mempoolInfo.count || 'Unknown'}`;
          }
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      byId('status').textContent = 'Connection error. Retrying...';
      
      // Retry connection after 5 seconds
      setTimeout(() => {
        connectToMempool();
      }, 5000);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Retry connection after 3 seconds
      setTimeout(() => {
        connectToMempool();
      }, 3000);
    };
    
  } catch (error) {
    console.error('Failed to connect to mempool:', error);
    byId('status').textContent = 'Failed to connect to Bitcoin network';
  }
}

/* --- ROUND FINISH AND SCORING --- */
function finishRound(block) {
  if (locked) return;
  
  locked = true;
  const actual = block.tx_count;
  blockHeight = block.height;
  
  byId('status').textContent = `Block ${block.height} mined with ${actual} txs. Scoring...`;

  if (guesses.length === 0) {
    byId('winnerBanner').textContent = 'No guesses in this round.';
    setTimeout(resetRound, 8000);
    return;
  }

  // Calculate differences and sort
  const ranked = [...guesses].map((g) => {
    g.diff = Math.abs(g.guess - actual);
    return g;
  }).sort((a, b) => a.diff - b.diff);

  // Mark winner
  const winner = ranked[0];
  winner.isWinner = true;
  
  // Check if current user won
  if (winner.fid === myFid) {
    userWins++;
    winStreak++;
    const shareWinBtn = byId('shareWinBtn');
    if (shareWinBtn) shareWinBtn.style.display = 'inline-block';
  } else {
    winStreak = 0;
  }

  byId('winnerBanner').textContent = `🎉 Winner: ${winner.name} (${winner.guess} txs, diff: ${winner.diff})`;
  createConfetti();

  // Update player list with results
  const playersList = byId('playersList');
  if (playersList) {
    playersList.innerHTML = ranked.map((g, i) => {
      const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const isMe = g.fid === myFid ? ' (You)' : '';
      return `<li>${medal} ${g.name}: ${g.guess} txs (diff: ${g.diff})${isMe}</li>`;
    }).join('');
  }

  updateGameStats();
  setTimeout(resetRound, 10000);
}

function resetRound() {
  guesses = [];
  locked = false;
  myGuess = null;
  roundNumber++;
  
  // Reset form
  const guessInput = byId('guessInp');
  const lockBtn = byId('lockBtn');
  
  if (guessInput) {
    guessInput.value = '';
    guessInput.disabled = false;
  }
  
  if (lockBtn) {
    lockBtn.textContent = 'Join Battle';
    lockBtn.disabled = false;
  }
  
  byId('winnerBanner').textContent = '';
  byId('status').textContent = 'New round started. Make your prediction!';
  
  pushHash();
  renderPlayers();
  updateGameStats();
  
  addChatMessage('System', `🚀 Round ${roundNumber} started! Make your predictions now!`, 'system');
}

function updateGameStats() {
  const roundNumberEl = byId('roundNumber');
  const userWinsEl = byId('userWins');
  const winStreakEl = byId('winStreak');
  
  if (roundNumberEl) roundNumberEl.textContent = roundNumber;
  if (userWinsEl) userWinsEl.textContent = userWins;
  if (winStreakEl) winStreakEl.textContent = winStreak;
}

/* --- CHAT FEATURE --- */
function sendMessage() {
  const chatInput = byId('chatInput');
  const message = chatInput.value.trim();
  
  if (!message) return;
  if (message.length > 200) {
    alert('Message too long (max 200 characters)');
    return;
  }

  // Display username with @ symbol for Farcaster users
  const displayName = myName === 'Anonymous' ? 'Anonymous' : `@${myName}`;
  addChatMessage(displayName, message, 'user');
  chatInput.value = '';
}

function addChatMessage(name, message, type = 'user') {
  const chatMessages = byId('chatMessages');
  if (!chatMessages) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message chat-message-${type}`;
  
  const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // Different styling based on message type
  let messageClass = '';
  let nameColor = '';
  
  switch(type) {
    case 'system':
      messageClass = 'system-message';
      nameColor = '#76ff40'; // Green for system messages
      break;
    case 'guess':
      messageClass = 'guess-message';
      nameColor = '#f7931a'; // Orange for guess messages
      break;
    case 'winner':
      messageClass = 'winner-message';
      nameColor = '#ffd700'; // Gold for winner messages
      break;
    case 'result':
      messageClass = 'result-message';
      nameColor = '#87ceeb'; // Light blue for results
      break;
    default:
      messageClass = 'user-message';
      nameColor = '#fff'; // White for regular user messages
  }
  
  messageElement.innerHTML = `
    <span class="chat-time">${timestamp}</span>
    <span class="chat-name" style="color: ${nameColor}">${name}:</span>
    <span class="chat-text ${messageClass}">${escapeHtml(message)}</span>
  `;
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Limit chat history to 100 messages for better performance
  while (chatMessages.children.length > 100) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* --- SOCIAL SHARING --- */
function shareWin() {
  if (!myGuess || userWins === 0) {
    alert('You haven\'t won yet!');
    return;
  }

  const shareData = {
    title: 'TX Battle Royale Win! 🏆',
    text: `I just won the TX Battle Royale with ${myGuess} txs! Win streak: ${winStreak} 🚀`,
    url: window.location.href
  };

  if (navigator.share && navigator.canShare(shareData)) {
    navigator.share(shareData);
  } else {
    copyToClipboard(`${shareData.text} ${shareData.url}`);
    alert('Win message copied to clipboard!');
  }
}

function shareGame() {
  const shareData = {
    title: 'Join TX Battle Royale',
    text: 'Join me in this exciting Bitcoin TX Battle Royale! Predict block transactions and win! 🎯',
    url: window.location.href
  };

  if (navigator.share && navigator.canShare(shareData)) {
    navigator.share(shareData);
  } else {
    copyToClipboard(`${shareData.text} ${shareData.url}`);
    alert('Game link copied to clipboard!');
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
  }
}

/* --- VISUAL EFFECTS --- */
function createConfetti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  confetti.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
    z-index: 9999;
  `;

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background-color: hsl(${Math.random() * 360}, 100%, 50%);
      border-radius: 50%;
      top: ${Math.random() * 100}%`;
      left: ${Math.random() * 100}%;
      opacity: 0;
      transition: all 2s ease-out;
    `;

    setTimeout(() => {
      particle.style.transform = `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)`;
      particle.style.opacity = '1';
    }, Math.random() * 100);

    setTimeout(() => {
      particle.style.transform = `translate(${Math.random() * 300 - 150}px, ${Math.random() * 300 - 150}px)`;
      particle.style.opacity = '0';
    }, 1000 + Math.random() * 1000);

    confetti.appendChild(particle);
  }

  document.body.appendChild(confetti);

  setTimeout(() => {
    if (document.body.contains(confetti)) {
      document.body.removeChild(confetti);
    }
  }, 4000);
}

/* --- BLOCK EXPLORER --- */
async function fetchCurrentBlock() {
  try {
    const response = await fetch('https://mempool.space/api/blocks/tip/height');
    const height = await response.text();
    
    const hashResponse = await fetch(`https://mempool.space/api/block-height/${height}`);
    const hash = await hashResponse.text();
    
    const blockResponse = await fetch(`https://mempool.space/api/block/${hash}`);
    const blockData = await blockResponse.json();

    displayBlockData('Current', height, blockData);
    
    // Update current block display
    const currentBlock = byId('currentBlock');
    if (currentBlock) {
      currentBlock.textContent = height;
    }
    
  } catch (error) {
    console.error('Error fetching current block:', error);
    byId('blockData').innerHTML = '<p>Failed to load current block data.</p>';
  }
}

async function fetchPreviousBlock() {
  try {
    const response = await fetch('https://mempool.space/api/blocks/tip/height');
    const currentHeight = parseInt(await response.text());
    const previousHeight = currentHeight - 1;
    
    const hashResponse = await fetch(`https://mempool.space/api/block-height/${previousHeight}`);
    const hash = await hashResponse.text();
    
    const blockResponse = await fetch(`https://mempool.space/api/block/${hash}`);
    const blockData = await blockResponse.json();

    displayBlockData('Previous', previousHeight, blockData);
  } catch (error) {
    console.error('Error fetching previous block:', error);
    byId('blockData').innerHTML = '<p>Failed to load previous block data.</p>';
  }
}

async function fetchNextBlock() {
  byId('blockData').innerHTML = '<p>Next block not yet mined. Check back later!</p>';
}

function displayBlockData(type, height, blockData) {
  const blockDataEl = byId('blockData');
  if (!blockDataEl) return;
  
  const timestamp = new Date(blockData.timestamp * 1000).toLocaleString();
  
  blockDataEl.innerHTML = `
    <div class="block-info">
      <h4>${type} Block #${height}</h4>
      <div class="block-details">
        <p><strong>Transactions:</strong> ${blockData.tx_count}</p>
        <p><strong>Size:</strong> ${(blockData.size / 1024 / 1024).toFixed(2)} MB</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <p><strong>Hash:</strong> <span class="hash">${blockData.id.substring(0, 16)}...</span></p>
      </div>
    </div>
  `;
}

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app...');
  initializeFarcasterSDK();
});

// Fallback initialization
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!isSDKReady) {
      console.warn('SDK initialization timeout, showing content anyway');
      showMainContent();
    }
  }, 8000);
});