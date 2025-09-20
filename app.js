/* --- CONFIG --- */
let blockHeight = 0;
let locked = true;
let guesses = [];
let myGuess = null;
let myFid = null;
let myName = 'Anon';
let sdk;

/* --- URL STATE MANAGEMENT --- */
function readHash() {
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    guesses = JSON.parse(p.get('g') || '[]');
    blockHeight = Number(p.get('h') || 0);
  } catch (e) {}
}

function pushHash() {
  const p = new URLSearchParams();
  p.set('g', JSON.stringify(guesses));
  p.set('h', blockHeight);
  location.hash = p.toString();
}

/* --- DOM HELPERS --- */
function byId(id) {
  return document.getElementById(id);
}

function renderPlayers() {
  byId('playersList').innerHTML = guesses.map((g, i) => {
    return `<li>${g.name || `Player ${i + 1}`}: ${g.guess} txs</li>`;
  }).join('');
  byId('playersCount').textContent = guesses.length;
}

/* --- GUESS LOGIC --- */
function lockGuess() {
  if (locked) return alert('Round locked. Wait for new block.');
  if (myGuess) return alert('You already guessed!');
  const val = Number(byId('guessInp').value);
  if (!val || isNaN(val) || val < 0) return alert('Enter a positive number');
  myGuess = val;
  guesses.push({ fid: myFid, name: myName, guess: val });
  pushHash();
  renderPlayers();
  byId('guessInp').disabled = true;
  byId('lockBtn').textContent = 'Locked ✅';
  byId('lockBtn').disabled = true;

  addChatMessage(myName, `I predict ${val} transactions for the next BTC block`);
  byId('status').textContent = `Your guess (${val} txs) has been recorded as the next block's transaction prediction.`;
}

/* --- WEBSOCKET FOR BLOCK DATA --- */
const ws = new WebSocket('wss://mempool.space/api/v1/ws');
ws.onopen = () => {
  byId('status').textContent = 'Connected. Waiting for block…';
};

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.block) {
    finishRound(data.block);
  }
  if (data.txCount) {
    byId('status').textContent = `Mempool est. ~${data.txCount} txs in next block`;
  }
};

/* --- ROUND FINISH AND SCORING --- */
function finishRound(block) {
  if (locked) return;
  locked = true;
  const actual = block.tx_count;
  byId('status').textContent = `Block ${block.height} mined with ${actual} txs. Scoring…`;

  if (guesses.length === 0) {
    byId('winnerBanner').textContent = 'No guesses in this round.';
    setTimeout(resetRound, 8000);
    return;
  }

  const ranked = [...guesses].map((g) => {
    g.diff = Math.abs(g.guess - actual);
    return g;
  }).sort((a, b) => a.diff - b.diff);

  const winner = ranked[0];
  byId('winnerBanner').textContent = `🎉 Winner: ${winner.name} (${winner.guess} txs)`;
  createConfetti();

  byId('playersList').innerHTML = ranked.map((g, i) => {
    return `<li>${g.name || `Player ${i + 1}`}: ${g.guess} (${g.diff}) ${i === 0 ? '🏆' : ''}</li>`;
  }).join('');

  setTimeout(resetRound, 8000);
}

function resetRound() {
  guesses = [];
  locked = false;
  myGuess = null;
  byId('guessInp').value = '';
  byId('guessInp').disabled = false;
  byId('lockBtn').textContent = 'Join Battle';
  byId('lockBtn').disabled = false;
  byId('winnerBanner').textContent = '';
  byId('status').textContent = 'New round started. Guess!';
  pushHash();
  renderPlayers();
}

/* --- Chat Feature --- */
function sendMessage() {
  const message = document.getElementById('chatInput').value;
  if (!message) return;

  addChatMessage(myName, message);
  document.getElementById('chatInput').value = '';
}

function addChatMessage(name, message) {
  const chatMessages = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.textContent = `${name}: ${message}`;
  messageElement.style.margin = '0.5rem 0';
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* --- Social Sharing --- */
function shareWin() {
  if (!myGuess || !guesses.find(g => g.fid === myFid)) {
    return alert('You haven\'t won yet!');
  }

  if (navigator.share) {
    navigator.share({
      title: 'TX Battle Royale Win',
      text: `I just won the TX Battle Royale with ${myGuess} txs!`,
      url: window.location.href
    });
  } else {
    copyToClipboard(`I just won the TX Battle Royale with ${myGuess} txs! ${window.location.href}`);
    alert('Win message copied to clipboard!');
  }
}

function shareGame() {
  if (navigator.share) {
    navigator.share({
      title: 'Join TX Battle Royale',
      text: 'Join me in this exciting Bitcoin TX Battle Royale!',
      url: window.location.href
    });
  } else {
    copyToClipboard(`Join me in this exciting Bitcoin TX Battle Royale! ${window.location.href}`);
    alert('Game link copied to clipboard!');
  }
}

function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/* --- Visual Feedback --- */
function createConfetti() {
  const confetti = document.createElement('div');
  confetti.style.position = 'fixed';
  confetti.style.top = '0';
  confetti.style.left = '0';
  confetti.style.width = '100%';
  confetti.style.height = '100%';
  confetti.style.pointerEvents = 'none';
  confetti.style.overflow = 'hidden';
  confetti.style.zIndex = '9999';

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = `${Math.random() * 10 + 5}px`;
    particle.style.height = particle.style.width;
    particle.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
    particle.style.borderRadius = '50%';
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.opacity = '0';
    particle.style.transition = 'all 2s ease-out';

    setTimeout(() => {
      particle.style.transform = `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)`;
      particle.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      particle.style.transform = `translate(${Math.random() * 300 - 150}px, ${Math.random() * 300 - 150}px)`;
      particle.style.opacity = '0';
      particle.style.transition = 'all 3s ease-out';
    }, 1000);

    confetti.appendChild(particle);
  }

  document.body.appendChild(confetti);

  setTimeout(() => {
    document.body.removeChild(confetti);
  }, 4000);
}

/* --- Block Explorer Code --- */
async function fetchCurrentBlock() {
  try {
    const currentBlockHeightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
    const currentBlockHeight = await currentBlockHeightResponse.text();
    const currentBlockHashResponse = await fetch(`https://mempool.space/api/block-height/${currentBlockHeight}`);
    const currentBlockHash = await currentBlockHashResponse.text();
    const currentBlockTransactionsResponse = await fetch(`https://mempool.space/api/block/${currentBlockHash}`);
    const currentBlockData = await currentBlockTransactionsResponse.json();

    const blockDataHTML = `
      <div class="block-info">
        <h3>Current Block (Height: ${currentBlockHeight})</h3>
        <p>Total Transactions: ${currentBlockData.tx_count}</p>
      </div>
    `;

    byId('blockData').innerHTML = blockDataHTML;
  } catch (error) {
    console.error('Error fetching current block data:', error);
    byId('blockData').innerHTML = '<p>Failed to load current block data. Please try again later.</p>';
  }
}

async function fetchPreviousBlock() {
  try {
    const currentBlockHeightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
    const currentBlockHeight = await currentBlockHeightResponse.text();
    const previousBlockHeight = parseInt(currentBlockHeight) - 1;

    const previousBlockHashResponse = await fetch(`https://mempool.space/api/block-height/${previousBlockHeight}`);
    const previousBlockHash = await previousBlockHashResponse.text();
    const previousBlockTransactionsResponse = await fetch(`https://mempool.space/api/block/${previousBlockHash}`);
    const previousBlockData = await previousBlockTransactionsResponse.json();

    const blockDataHTML = `
      <div class="block-info">
        <h3>Previous Block (Height: ${previousBlockHeight})</h3>
        <p>Total Transactions: ${previousBlockData.tx_count}</p>
      </div>
    `;

    byId('blockData').innerHTML = blockDataHTML;
  } catch (error) {
    console.error('Error fetching previous block data:', error);
    byId('blockData').innerHTML = '<p>Failed to load previous block data. Please try again later.</p>';
  }
}

async function fetchNextBlock() {
  try {
    const currentBlockHeightResponse = await fetch('https://mempool.space/api/blocks/tip/height');
    const currentBlockHeight = await currentBlockHeightResponse.text();
    const nextBlockHeight = parseInt(currentBlockHeight) + 1;

    const nextBlockHashResponse = await fetch(`https://mempool.space/api/block-height/${nextBlockHeight}`);
    const nextBlockHash = await nextBlockHashResponse.text();
    const nextBlockTransactionsResponse = await fetch(`https://mempool.space/api/block/${nextBlockHash}`);
    const nextBlockData = await nextBlockTransactionsResponse.json();

    const blockDataHTML = `
      <div class="block-info">
        <h3>Next Block (Height: ${nextBlockHeight})</h3>
        <p>Total Transactions: ${nextBlockData.tx_count}</p>
      </div>
    `;

    byId('blockData').innerHTML = blockDataHTML;
  } catch (error) {
    console.error('Error fetching next block data:', error);
    byId('blockData').innerHTML = '<p>Next block not yet mined or failed to load. Please try again later.</p>';
  }
}

/* --- Farcaster Integration --- */
async function connectWallet() {
  try {
    const { sdk: farcasterSdk } = await import('https://esm.sh/@farcaster/miniapp-sdk@0.1.10');
    sdk = farcasterSdk;

    const { fid, name } = await sdk.actions.signIn();
    myFid = fid;
    myName = name;

    byId('status').textContent = `Connected to Farcaster as ${name} (${fid})`;
    addChatMessage('System', `${name} (${fid}) has joined the battle!`);
  } catch (error) {
    console.error('Error connecting to Farcaster wallet:', error);
    alert('Failed to connect to Farcaster wallet. Please try again.');
  }
}

/* --- SDK Integration and Initialization --- */
async function initializeMiniApp() {
  try {
    console.log('Initializing Farcaster MiniApp SDK...');

    // Import the SDK dynamically
    const farcasterSdk = await import('https://esm.sh/@farcaster/miniapp-sdk@0.1.10');
    sdk = farcasterSdk.default; // Use the default export

    try {
      const user = await sdk.user.get();
      if (user) {
        myFid = user.fid;
        myName = user.name;
        byId('status').textContent = `Connected to Farcaster as ${user.name} (${user.fid})`;
      }
    } catch (error) {
      console.log('No existing session. Showing connect wallet button.');
      document.getElementById('connectWalletBtn').style.display = 'block';
    }

    if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    console.log('DOM ready, calling sdk.actions.ready()...');
    await sdk.actions.ready();

    console.log('MiniApp is ready!');
    showContent();
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize MiniApp:', error);
    showError();
  }
}

function showContent() {
  const loadingScreen = document.getElementById('loadingScreen');
  const mainContainer = document.querySelector('.container');

  loadingScreen.classList.add('hidden');
  setTimeout(() => {
    mainContainer.style.opacity = '1';
    mainContainer.style.transform = 'translateY(0)';
  }, 100);
}

function showError() {
  const loadingScreen = document.getElementById('loadingScreen');
  const mainContainer = document.querySelector('.container');
  const errorMessage = document.createElement('div');
  errorMessage.style.background = 'rgba(255, 0, 0, 0.1)';
  errorMessage.style.border = '1px solid rgba(255, 0, 0, 0.3)';
  errorMessage.style.color = 'white';
  errorMessage.style.padding = '15px';
  errorMessage.style.borderRadius = '10px';
  errorMessage.style.marginBottom = '20px';
  errorMessage.textContent = '⚠️ Failed to initialize MiniApp SDK. Please refresh the page.';

  loadingScreen.classList.add('hidden');
  mainContainer.insertBefore(errorMessage, mainContainer.firstChild);
}

function setupEventListeners() {
  document.getElementById('lockBtn').onclick = lockGuess;
  document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

/* --- INITIAL RENDER --- */
initializeMiniApp();

// Fallback timeout reduced to 5 seconds
setTimeout(() => {
  const loadingScreen = document.getElementById('loadingScreen');
  if (!loadingScreen.classList.contains('hidden')) {
    console.warn('SDK initialization timeout, showing content anyway');
    showContent();
  }
}, 5000);
      
