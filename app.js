// app.js — client-side logic for TX Battle Royale
// Connects to BACKEND_URL (Replit) for real-time events via socket.io
// Expects global BACKEND_URL constant defined in index.html

(function() {
  const BACKEND = (typeof BACKEND_URL !== 'undefined' && BACKEND_URL) ? BACKEND_URL : window.location.origin;
  const SOCKET_PATH = '/socket.io';

  // DOM refs
  const statusEl = document.getElementById('status') || (function(){ const el = document.createElement('div'); el.id='status'; el.style.display='none'; document.body.appendChild(el); return el; })();
  const joinBtn = document.getElementById('joinBtn');
  const shareBtn = document.getElementById('shareBtn');
  const prevBlockBtn = document.getElementById('prevBlockBtn');
  const currBlockBtn = document.getElementById('currBlockBtn');
  const predictionInput = document.getElementById('predictionInput');
  const submitPredictionBtn = document.getElementById('submitPredictionBtn');
  const playersContainer = document.getElementById('playersContainer');
  const leaderboardContainer = document.getElementById('leaderboardContainer');
  const currentBlockContainer = document.getElementById('currentBlock');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const messagesList = document.getElementById('messagesList');
  const playerCount = document.getElementById('playerCount');

  let socket = null;
  let isConnected = false;
  let userFid = localStorage.getItem('tx_battle_fid') || null;
  let userProfile = (function(){ try { return JSON.parse(localStorage.getItem('tx_battle_profile') || 'null'); } catch(e) { return null; } })();

  function updateStatus(text, isError) {
    if (!statusEl) return;
    statusEl.innerText = text;
    if (isError) statusEl.style.color = '#ff6b6b'; else statusEl.style.color = '';
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch (e) { return ts; }
  }

  function renderPlayers(list) {
    if (!playersContainer) return;
    playersContainer.innerHTML = '';
    if (!Array.isArray(list)) return;
    if (playerCount) playerCount.textContent = `(${list.length})`;
    list.forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-item';
      li.innerHTML = `<div style="display:flex;justify-content:space-between"><strong>${escapeHtml(p.profile?.name || p.name || p.fid || 'anon')}</strong><span class="muted">${Number(p.score || 0)}</span></div>
                      <div class="muted">Prediction: ${escapeHtml(p.prediction || '-')}</div>`;
      playersContainer.appendChild(li);
    });
  }

  function renderLeaderboard(list) {
    if (!leaderboardContainer) return;
    leaderboardContainer.innerHTML = '';
    if (!Array.isArray(list)) return;
    list.forEach((r,i) => {
      const li = document.createElement('li');
      li.className = 'leader-item';
      li.innerHTML = `<strong>#${i+1} ${escapeHtml(r.name || r.fid || 'anon')}</strong> <span class="muted">${Number(r.score || 0)}</span>`;
      leaderboardContainer.appendChild(li);
    });
  }

  function renderBlock(block) {
    if (!currentBlockContainer) return;
    if (!block) {
      currentBlockContainer.innerHTML = '<div class="muted">No block loaded</div>';
      return;
    }
    currentBlockContainer.innerHTML = `<div><strong>Block #${escapeHtml(String(block.number || block.height || '—'))}</strong></div>
                                      <div class="muted">Time: ${fmtTime(block.timestamp || Date.now())}</div>
                                      <div class="muted">Hash: ${escapeHtml(block.hash || block.id || '-')}</div>`;
  }

  function appendChatMessage(msg) {
    if (!messagesList) return;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<small class="muted">${escapeHtml(msg.from || msg.fid || 'anon')} • ${fmtTime(msg.timestamp || Date.now())}</small><div>${escapeHtml(msg.text || msg.message || '')}</div>`;
    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function connectSocket() {
    if (typeof io === 'undefined') {
      updateStatus('socket.io client missing', true);
      console.error('socket.io client not found; ensure script loaded from backend.');
      return;
    }

    socket = io(BACKEND_URL, { path: SOCKET_PATH, transports: ['websocket','polling'] });

    socket.on('connect', () => {
      isConnected = true;
      updateStatus('Connected');
      console.log('socket connected', socket.id);
      if (userFid) socket.emit('join', { fid: userFid, profile: userProfile });
    });

    socket.on('disconnect', (reason) => {
      isConnected = false;
      updateStatus('Disconnected', true);
      console.warn('socket disconnected', reason);
    });

    socket.on('connect_error', (err) => {
      isConnected = false;
      updateStatus('Connection error', true);
      console.error('connect_error', err);
    });

    socket.on('state', (data) => {
      if (!data) return;
      if (data.block) renderBlock(data.block);
      if (data.players) renderPlayers(data.players);
      if (data.leaderboard) renderLeaderboard(data.leaderboard);
      if (Array.isArray(data.chat)) data.chat.forEach(appendChatMessage);
    });

    socket.on('players_update', renderPlayers);
    socket.on('leaderboard', renderLeaderboard);
    socket.on('block_update', renderBlock);
    socket.on('chat_message', appendChatMessage);
    socket.on('mempool_tx', (tx) => {
      // optional: handle mempool tx UI updates if desired
      console.debug('mempool_tx', tx);
    });
  }

  // UI actions
  function joinGame() {
    if (!socket || !isConnected) { updateStatus('Not connected to server', true); return; }
    if (!userFid) {
      userFid = `guest-${Math.floor(Math.random()*100000)}`;
      userProfile = { name: `Guest ${userFid.slice(-4)}` };
      localStorage.setItem('tx_battle_fid', userFid);
      localStorage.setItem('tx_battle_profile', JSON.stringify(userProfile));
    }
    socket.emit('join', { fid: userFid, profile: userProfile });
    updateStatus('Joining as ' + (userProfile?.name || userFid));
  }

  function submitPrediction() {
    if (!socket || !isConnected) { updateStatus('Not connected', true); return; }
    const val = predictionInput.value;
    if (!val) { updateStatus('Enter a prediction', true); return; }
    socket.emit('submit_prediction', { fid: userFid, prediction: val, timestamp: Date.now() });
    updateStatus('Prediction sent');
    predictionInput.value = '';
  }

  function sendChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!socket || !isConnected) { updateStatus('Not connected', true); return; }
    const txt = chatInput.value;
    if (!txt) return;
    const payload = { fid: userFid, text: txt, timestamp: Date.now() };
    socket.emit('chat_message', payload);
    appendChatMessage({ from: userProfile?.name || userFid || 'me', text: txt, timestamp: Date.now() });
    chatInput.value = '';
  }

  // Wire UI
  document.addEventListener('DOMContentLoaded', () => {
    if (joinBtn) joinBtn.addEventListener('click', joinGame);
    if (submitPredictionBtn) submitPredictionBtn.addEventListener('click', submitPrediction);
    if (chatForm) chatForm.addEventListener('submit', sendChat);
    if (shareBtn) shareBtn.addEventListener('click', () => { navigator.clipboard?.writeText(window.location.href).then(()=> updateStatus('Link copied')); });
    if (prevBlockBtn) prevBlockBtn.addEventListener('click', () => { socket && socket.emit('request_prev_block'); });
    if (currBlockBtn) currBlockBtn.addEventListener('click', () => { socket && socket.emit('request_current_block'); });
    updateStatus('Connecting...');
    connectSocket();
  });

  // safe Farcaster SDK ready call
  try {
    if (typeof sdk !== 'undefined' && sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
      sdk.actions.ready();
      console.log('sdk.actions.ready() called');
    }
  } catch (e) { /* ignore */ }

})();
