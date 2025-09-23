// app.js
// Frontend (browser) script for TX Battle Royale
// - Terhubung ke backend via socket.io (real-time, live data).
// - Tidak menggunakan dummy data — semua state berasal dari socket events.
// - Memanggil sdk.actions.ready() secara aman bila tersedia (Farcaster miniapp).
// - Replit URL (production) dimasukkan eksplisit sesuai permintaan.

//
// CONFIG
//
const REPLIT_URL = 'https://25b09b7b-8fbd-46f6-a599-1a3a8bdad572-00-110pjaimlcgd1.worf.replit.dev'; // <- wajib, bukan dummy
const SOCKET_PATH = '/socket.io'; // path proxied oleh server.js
const SOCKET_URL = REPLIT_URL; // pakai URL Replit sebagai origin untuk koneksi socket

// ---------------------------
// Utilities
// ---------------------------
function $id(id) { return document.getElementById(id); }

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleString();
  } catch (e) {
    return String(ts);
  }
}

function safeEl(el) {
  return el || { innerHTML: '', innerText: '', value: '', appendChild() {}, scrollTop: 0, scrollHeight: 0 };
}

// ---------------------------
// DOM refs (expects these IDs in index.html)
// ---------------------------
const statusEl = $id('status');
const joinBtn = $id('joinBtn');
const shareBtn = $id('shareBtn');
const prevBlockBtn = $id('prevBlockBtn');
const currBlockBtn = $id('currBlockBtn');
const predictionInput = $id('predictionInput');
const submitPredictionBtn = $id('submitPredictionBtn');
const playersContainer = $id('playersContainer');
const leaderboardContainer = $id('leaderboardContainer');
const currentBlockContainer = $id('currentBlock');
const chatForm = $id('chatForm');
const chatInput = $id('chatInput');
const messagesList = $id('messagesList');

// ---------------------------
// App state
// ---------------------------
let socket = null;
let isConnected = false;
let userFid = localStorage.getItem('tx_battle_fid') || null;
let userProfile = (() => {
  try { return JSON.parse(localStorage.getItem('tx_battle_profile') || 'null'); } catch(e){ return null; }
})();
let players = [];
let leaderboard = [];
let currentBlock = null;

// ---------------------------
// Rendering functions
// ---------------------------
function updateStatus(text, isError = false) {
  const el = safeEl(statusEl);
  el.innerText = text;
  if (el.classList) {
    if (isError) el.classList.add('error'); else el.classList.remove('error');
  }
}

function renderPlayers(list) {
  players = Array.isArray(list) ? list : players;
  const container = safeEl(playersContainer);
  container.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-row';
    div.innerHTML = `
      <div class="player-name">${escapeHtml(p.name || p.fid || 'anon')}</div>
      <div class="player-meta">Score: ${Number(p.score || 0)} • Prediction: ${escapeHtml(String(p.prediction || '-'))}</div>
    `;
    container.appendChild(div);
  });
}

function renderLeaderboard(list) {
  leaderboard = Array.isArray(list) ? list : leaderboard;
  const container = safeEl(leaderboardContainer);
  container.innerHTML = '';
  leaderboard.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'leaderboard-row';
    div.innerHTML = `<strong>#${i+1}</strong> ${escapeHtml(r.name || r.fid || 'anon')} — ${Number(r.score||0)}`;
    container.appendChild(div);
  });
}

function renderCurrentBlock(block) {
  if (!block) {
    currentBlock = currentBlock || null;
  } else {
    currentBlock = block;
  }
  const c = safeEl(currentBlockContainer);
  if (!currentBlock) {
    c.innerText = 'No block yet';
    return;
  }
  c.innerHTML = `
    <div class="block-number">Block: ${escapeHtml(String(currentBlock.number || currentBlock.height || '—'))}</div>
    <div class="block-time">Time: ${formatTime(currentBlock.timestamp || currentBlock.time || Date.now())}</div>
    <div class="block-hash">Hash: ${escapeHtml(String(currentBlock.hash || currentBlock.id || '-'))}</div>
  `;
}

function appendChatMessage(msg) {
  const ul = safeEl(messagesList);
  const li = document.createElement('li');
  li.className = 'chat-item';
  const who = escapeHtml(msg.from || msg.fid || 'anon');
  const text = escapeHtml(msg.text || msg.message || '');
  const ts = formatTime(msg.timestamp || Date.now());
  li.innerHTML = `<small class="meta">${who} • ${ts}</small><div class="msg">${text}</div>`;
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

// ---------------------------
// Socket (real-time) connection
// ---------------------------
function connectSocket() {
  // Always attempt to connect to the provided Replit URL (real-time endpoint).
  // The server should proxy /socket.io to the backend (server.js takes care of spawn + proxy).
  try {
    // Ensure socket.io client script is loaded in index.html:
    // <script src="/socket.io/socket.io.js"></script>
    if (typeof io === 'undefined') {
      console.error('socket.io client not found. Please include <script src="/socket.io/socket.io.js"></script> in index.html');
      updateStatus('socket.io client missing', true);
      return;
    }

    // Create socket that connects to the Replit URL (secure wss when https)
    socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelayMax: 2000
    });

    socket.on('connect', () => {
      isConnected = true;
      updateStatus('Connected', false);
      console.log('Socket connected:', socket.id);
      // If we have a stored user fid, attempt to rejoin
      if (userFid) {
        socket.emit('join', { fid: userFid, profile: userProfile });
      }
    });

    socket.on('disconnect', (reason) => {
      isConnected = false;
      updateStatus('Disconnected', true);
      console.warn('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      isConnected = false;
      updateStatus('Connection error', true);
      console.error('Socket connect_error:', err);
    });

    // Application events: these must be emitted by the backend (live data)
    socket.on('state', (data) => {
      // expected: { block, players, leaderboard, chat }
      if (!data) return;
      if (data.block) renderCurrentBlock(data.block);
      if (data.players) renderPlayers(data.players);
      if (data.leaderboard) renderLeaderboard(data.leaderboard);
      if (Array.isArray(data.chat)) data.chat.forEach(appendChatMessage);
    });

    socket.on('players_update', (data) => renderPlayers(data || []));
    socket.on('leaderboard', (data) => renderLeaderboard(data || []));
    socket.on('block_update', (block) => renderCurrentBlock(block));
    socket.on('chat_message', (msg) => appendChatMessage(msg || {}));

    // handle custom backend events for real-time blockchain feed if present
    socket.on('mempool_tx', (tx) => {
      // backend may emit raw mempool transactions — handle as needed (e.g., show in UI)
      console.log('mempool_tx', tx);
      // You can add UI logic here to list recent txs if desired
    });

  } catch (e) {
    console.error('connectSocket failed', e);
    updateStatus('Socket init failed', true);
  }
}

// ---------------------------
// UI actions that emit to server
// ---------------------------
function joinGame() {
  if (!socket || !isConnected) {
    updateStatus('Not connected to server', true);
    return;
  }
  // create or re-use fid
  if (!userFid) {
    userFid = `guest-${Math.floor(Math.random() * 100000)}`;
    userProfile = { name: `Guest ${userFid.slice(-4)}` };
    localStorage.setItem('tx_battle_fid', userFid);
    localStorage.setItem('tx_battle_profile', JSON.stringify(userProfile));
  }
  socket.emit('join', { fid: userFid, profile: userProfile });
  updateStatus(`Joining as ${userProfile?.name || userFid}`);
}

function submitPrediction() {
  if (!socket || !isConnected) {
    updateStatus('Not connected', true);
    return;
  }
  const val = safeEl(predictionInput).value;
  if (!val) {
    updateStatus('Enter your prediction', true);
    return;
  }
  const payload = { fid: userFid, prediction: val, timestamp: Date.now() };
  socket.emit('submit_prediction', payload);
  updateStatus('Prediction sent');
  safeEl(predictionInput).value = '';
}

function sendChat(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!socket || !isConnected) {
    updateStatus('Not connected', true);
    return;
  }
  const text = safeEl(chatInput).value;
  if (!text) return;
  const msg = { fid: userFid, text, timestamp: Date.now() };
  socket.emit('chat_message', msg);
  appendChatMessage({ from: userProfile?.name || userFid || 'me', text, timestamp: Date.now() });
  safeEl(chatInput).value = '';
}

function shareGame() {
  try {
    const url = REPLIT_URL;
    if (navigator.share) {
      navigator.share({ title: 'TX Battle Royale', text: 'Join my game', url });
    } else {
      navigator.clipboard.writeText(url).then(() => updateStatus('Link copied'));
    }
  } catch (e) {
    console.warn('Share failed', e);
    updateStatus('Share failed', true);
  }
}

// ---------------------------
// Wire UI event handlers
// ---------------------------
function wireUi() {
  if (joinBtn) joinBtn.addEventListener('click', joinGame);
  if (shareBtn) shareBtn.addEventListener('click', shareGame);
  if (submitPredictionBtn) submitPredictionBtn.addEventListener('click', submitPrediction);
  if (chatForm) chatForm.addEventListener('submit', sendChat);
  if (prevBlockBtn) prevBlockBtn.addEventListener('click', () => {
    if (socket && isConnected) socket.emit('request_prev_block');
  });
  if (currBlockBtn) currBlockBtn.addEventListener('click', () => {
    if (socket && isConnected) socket.emit('request_current_block');
  });
}

// ---------------------------
// Init
// ---------------------------
document.addEventListener('DOMContentLoaded', () => {
  wireUi();
  updateStatus('Connecting...');
  connectSocket();

  // if connection not established quickly, let user know
  setTimeout(() => {
    if (!isConnected) updateStatus('Waiting for backend connection...');
  }, 4000);
});

// ---------------------------
// Platform: Farcaster miniapp ready() call (safe wrapper)
// ---------------------------
try {
  if (typeof sdk !== 'undefined' && sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
    sdk.actions.ready();
    console.log('sdk.actions.ready() called');
  } else {
    console.log('sdk.actions.ready not available (not running inside Farcaster miniapp).');
  }
} catch (e) {
  console.warn('sdk.actions.ready() failed:', e);
      }
