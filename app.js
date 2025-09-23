/* app.js - frontend client (full)
   - Robust Farcaster ready() handler
   - Connect to backend via socket.io (BACKEND_URL provided in index.html)
   - Render UI: current block, players, leaderboard, chat
   - IDs expected in index.html:
     - joinBtn, shareBtn, prevBlockBtn, currBlockBtn
     - predictionInput, submitPredictionBtn
     - playersContainer, leaderboardContainer
     - currentBlock, messagesList, chatForm, chatInput
     - playerCount, status (optional)
*/

//////////////////////
// Farcaster ready handler (robust)
//////////////////////
(function ensureFarcasterReady() {
  const SDK_URL = "https://unpkg.com/@farcaster/miniapp-sdk@latest/dist/index.umd.js";
  const maxAttempts = 6;
  let attempts = 0;
  let readyCalled = false;

  function callReadyIfPossible() {
    try {
      const sdkCandidate = window.miniApp || window.sdk || (typeof MiniAppSDK !== 'undefined' ? MiniAppSDK : undefined);
      if (sdkCandidate && sdkCandidate.actions && typeof sdkCandidate.actions.ready === 'function') {
        try {
          sdkCandidate.actions.ready();
          console.log('[Farcaster] sdk.actions.ready() called');
          readyCalled = true;
          return true;
        } catch (errReady) {
          console.warn('[Farcaster] sdk.actions.ready() call failed:', errReady);
        }
      }
    } catch (e) {
      console.warn('[Farcaster] callReadyIfPossible error', e);
    }
    return false;
  }

  function sendPostMessageFallback() {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'ready' }, '*');
        console.log('[Farcaster] posted fallback ready message to parent');
      }
    } catch (e) {
      console.warn('[Farcaster] postMessage fallback failed', e);
    }
  }

  function tryOnce() {
    attempts++;
    if (readyCalled) return;

    if (callReadyIfPossible()) return;

    if (attempts >= maxAttempts) {
      console.warn('[Farcaster] sdk not available after retries — using postMessage fallback');
      sendPostMessageFallback();
      return;
    }

    const backoffMs = Math.min(2000, 100 * Math.pow(2, attempts)) + Math.floor(Math.random() * 120);
    setTimeout(tryOnce, backoffMs);
  }

  function ensureScriptLoadedAndTry() {
    if (callReadyIfPossible()) return;

    const existing = document.querySelector('script[data-farcaster-sdk]');
    if (existing) {
      existing.addEventListener('load', () => { setTimeout(tryOnce, 50); });
      tryOnce();
      return;
    }

    try {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.setAttribute('data-farcaster-sdk', '1');
      s.onload = function() {
        console.log('[Farcaster] SDK script loaded from CDN');
        if (typeof MiniAppSDK !== 'undefined') {
          window.miniApp = window.miniApp || MiniAppSDK;
          window.sdk = window.sdk || MiniAppSDK;
        }
        setTimeout(tryOnce, 50);
      };
      s.onerror = function(e) {
        console.warn('[Farcaster] SDK script load failed', e);
        setTimeout(tryOnce, 100);
      };
      document.head.appendChild(s);
    } catch (e) {
      console.warn('[Farcaster] unable to inject SDK script', e);
      setTimeout(tryOnce, 100);
    }

    tryOnce();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ensureScriptLoadedAndTry();
  } else {
    document.addEventListener('DOMContentLoaded', ensureScriptLoadedAndTry, { once: true });
    window.addEventListener('load', () => setTimeout(ensureScriptLoadedAndTry, 120), { once: true });
  }
})();

//////////////////////
// Main client logic
//////////////////////
(function() {
  // BACKEND_URL should be set in index.html (const BACKEND_URL = "https://....")
  const BACKEND = (typeof BACKEND_URL !== 'undefined' && BACKEND_URL) ? BACKEND_URL : window.location.origin;
  const SOCKET_PATH = '/socket.io';

  // DOM refs (match IDs in index.html exactly)
  const statusEl = document.getElementById('status') || (() => {
    const el = document.createElement('div');
    el.id = 'status'; el.style.display = 'none'; document.body.appendChild(el); return el;
  })();

  const joinBtn = document.getElementById('joinBtn');
  const shareBtn = document.getElementById('shareBtn');
  const prevBlockBtn = document.getElementById('prevBlockBtn');
  const currBlockBtn = document.getElementById('currBlockBtn');

  const predictionInput = document.getElementById('predictionInput');
  const submitPredictionBtn = document.getElementById('submitPredictionBtn'); // match index.html
  const playersContainer = document.getElementById('playersContainer');
  const leaderboardContainer = document.getElementById('leaderboardContainer');
  const currentBlockContainer = document.getElementById('currentBlock');
  const messagesList = document.getElementById('messagesList');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  const playerCount = document.getElementById('playerCount');

  let socket = null;
  let isConnected = false;
  let userFid = localStorage.getItem('tx_battle_fid') || null;
  let userProfile = (() => {
    try { return JSON.parse(localStorage.getItem('tx_battle_profile') || 'null'); } catch(e) { return null; }
  })();

  function updateStatus(text, isError) {
    if (!statusEl) return;
    statusEl.innerText = text;
    statusEl.style.color = isError ? '#ff6b6b' : '';
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
      li.innerHTML = `<div style="display:flex;justify-content:space-between"><strong>${escapeHtml(p.profile?.name || p.name || p.fid || 'anon')}</strong><span class="muted">${Number(p.score || 0)}</span></div><div class="muted">Prediction: ${escapeHtml(p.prediction || '-')}</div>`;
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
    currentBlockContainer.innerHTML = `<div><strong>Block #${escapeHtml(String(block.number || block.height || '—'))}</strong></div><div class="muted">Time: ${fmtTime(block.timestamp || Date.now())}</div><div class="muted">Hash: ${escapeHtml(block.hash || block.id || '-')}</div>`;
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
      console.error('socket.io client not found; ensure script loaded from backend (or CDN).');
      return;
    }

    socket = io(BACKEND, { path: SOCKET_PATH, transports: ['websocket','polling'] });

    socket.on('connect', () => {
      isConnected = true;
      updateStatus('Connected');
      console.log('socket connected', socket.id);
      if (userFid) socket.emit('join', { fid: userFid, profile: userProfile });
    });

    socket.on('disconnect', reason => {
      isConnected = false;
      updateStatus('Disconnected', true);
      console.warn('socket disconnected', reason);
    });

    socket.on('connect_error', err => {
      isConnected = false;
      updateStatus('Connection error', true);
      console.error('connect_error', err);
    });

    socket.on('state', data => {
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
    socket.on('mempool_tx', tx => { console.debug('mempool_tx', tx); });
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
    const val = predictionInput ? predictionInput.value : null;
    if (!val) { updateStatus('Enter a prediction', true); return; }
    socket.emit('submit_prediction', { fid: userFid, prediction: val, timestamp: Date.now() });
    updateStatus('Prediction sent');
    if (predictionInput) predictionInput.value = '';
  }

  function sendChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!socket || !isConnected) { updateStatus('Not connected', true); return; }
    const txt = chatInput ? chatInput.value : '';
    if (!txt) return;
    const payload = { fid: userFid, text: txt, timestamp: Date.now() };
    socket.emit('chat_message', payload);
    appendChatMessage({ from: userProfile?.name || userFid || 'me', text: txt, timestamp: Date.now() });
    if (chatInput) chatInput.value = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (joinBtn) joinBtn.addEventListener('click', joinGame);
    if (submitPredictionBtn) submitPredictionBtn.addEventListener('click', submitPrediction);
    if (chatForm) chatForm.addEventListener('submit', sendChat);
    if (shareBtn) shareBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(window.location.href).then(()=> updateStatus('Link copied')).catch(()=> updateStatus('Copy failed', true));
    });
    if (prevBlockBtn) prevBlockBtn.addEventListener('click', () => { socket && socket.emit('request_prev_block'); });
    if (currBlockBtn) currBlockBtn.addEventListener('click', () => { socket && socket.emit('request_current_block'); });

    updateStatus('Connecting...');
    connectSocket();
  });

  // Attempt safe ready call as last resort (SDK init handled above)
  try {
    const sdkCandidate = window.miniApp || window.sdk || (typeof MiniAppSDK !== 'undefined' ? MiniAppSDK : undefined);
    if (sdkCandidate && sdkCandidate.actions && typeof sdkCandidate.actions.ready === 'function') {
      try { sdkCandidate.actions.ready(); console.log('[Farcaster] ready() called (final)'); } catch(e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
})();
