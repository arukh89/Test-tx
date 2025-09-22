// Ambil URL backend dari config.js
const socket = io(BACKEND_URL);

let currentUser = "Anonymous";
let currentBlock = { height: 0, tx_count: 0 };
let previousBlock = { height: 0, tx_count: 0 };

const el = id => document.getElementById(id);

function appendChat(msg) {
  const box = el('chatMessages');
  const d = document.createElement('div');
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", { hour12: false });

  let cssClass = "chat-normal";
  if (msg.startsWith("🔮")) cssClass = "chat-prediction";
  else if (msg.startsWith("🏁")) cssClass = "chat-settlement";
  else if (msg.startsWith("✍️")) cssClass = "chat-typing";

  d.className = cssClass;
  d.textContent = `[${timeStr}] ${msg}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function renderPlayers(players) {
  const list = el('playersList'); 
  list.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.display || p.fid}: ${p.guess}`;
    list.appendChild(li);
  });
  el('playersCount').textContent = players.length;
}

function renderLeaderboard(items) {
  const list = el('leaderboardList'); 
  list.innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    if (idx === 0) { li.classList.add('gold'); li.innerHTML = `🥇 <span>${it.name}</span><span>${it.wins}</span>`; }
    else if (idx === 1) { li.classList.add('silver'); li.innerHTML = `🥈 <span>${it.name}</span><span>${it.wins}</span>`; }
    else if (idx === 2) { li.classList.add('bronze'); li.innerHTML = `🥉 <span>${it.name}</span><span>${it.wins}</span>`; }
    else { li.innerHTML = `<span>${it.name}</span><span>${it.wins}</span>`; }
    list.appendChild(li);
  });
}

// 🔑 Koneksi ke wallet Farcaster
async function connectWallet() {
  if (typeof sdk !== "undefined" && sdk.wallet) {
    try {
      const user = await sdk.wallet.getUser();
      currentUser = user.username || `fid:${user.fid}`;
      el('userName').textContent = currentUser;

      // opsional: ambil address wallet
      const addr = await sdk.wallet.getAddress();
      console.log("Wallet address:", addr);

      appendChat(`🔗 Connected as ${currentUser}`);
      socket.emit('join', { display: currentUser, fid: user.fid, address: addr });
    } catch (err) {
      console.error("Wallet connect failed:", err);
      appendChat("⚠️ Gagal konek ke Farcaster wallet");
    }
  } else {
    console.log("Farcaster SDK tidak tersedia (mungkin bukan dalam MiniApp preview).");
  }
}

// socket events
socket.on('connect', () => {
  el('status').textContent = 'Connected to server';
  connectWallet(); // ✅ koneksi wallet saat socket connect
});

socket.on('disconnect', () => {
  el('status').textContent = 'Disconnected. Trying to reconnect...';
});

socket.on('state', state => {
  renderPlayers(state.players || []);
  renderLeaderboard(state.leaderboard || []);
  if (state.currentBlock) currentBlock = state.currentBlock;
  if (state.previousBlock) previousBlock = state.previousBlock;
  if (currentBlock.height > 0) {
    el('status').innerHTML = `Live block: ${currentBlock.height} | ${currentBlock.tx_count} TXs`;
  }
});

socket.on('chat', m => appendChat(m));
socket.on('settlement', s => {
  appendChat('🏁 Settlement: ' + JSON.stringify(s));
});

// prediction
el('submitPrediction').addEventListener('click', async () => {
  const v = parseInt(el('predictionInput').value);
  if (Number.isNaN(v) || v <= 0) return alert('Enter a positive number');

  let sig = null;
  if (window.farcaster && window.farcaster.sign) {
    try {
      const payload = JSON.stringify({ type: 'prediction', guess: v, ts: Date.now() });
      sig = await window.farcaster.sign(payload);
    } catch (e) { console.warn('sign failed', e); }
  }

  socket.emit('prediction', { guess: v, sig, user: currentUser });
  socket.emit('chat', `🔮 ${currentUser} menebak: ${v} TX`);
  el('predictionInput').value = '';
});

// typing
let typingTimeout;
el('predictionInput').addEventListener('input', () => {
  socket.emit('chat', `✍️ ${currentUser} sedang mengetik tebakan...`);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {}, 2000);
});

// manual chat
el('sendMessage').addEventListener('click', () => {
  const msg = el('chatInput').value.trim(); 
  if (!msg) return;
  socket.emit('chat', `${currentUser}: ${msg}`);
  el('chatInput').value = '';
});

// join manual (kalau user klik tombol "Join Battle")
el('joinButton').addEventListener('click', () => {
  if (currentUser === "Anonymous") {
    currentUser = `User-${socket.id.slice(0,4)}`;
    el('userName').textContent = currentUser;
  }
  socket.emit('join', { display: currentUser });
});

// share
el('shareBtn').addEventListener('click', () => {
  if (navigator.share) {
    navigator.share({ title: 'TX Battle Royale', text: 'Join my battle', url: location.href });
  } else {
    alert('Share not available');
  }
});

// block buttons
el('prevBlockBtn').addEventListener('click', () => {
  if (previousBlock.height > 0) {
    appendChat(`⬅️ Previous Block: Height ${previousBlock.height}, TXs ${previousBlock.tx_count}`);
  } else {
    appendChat("No previous block data available.");
  }
});

el('presentBlockBtn').addEventListener('click', () => {
  if (currentBlock.height > 0) {
    appendChat(`📦 Present Block: Height ${currentBlock.height}, TXs ${currentBlock.tx_count}`);
  } else {
    appendChat("No current block data yet.");
  }
});

// ✅ Beritahu Farcaster kalau app sudah siap (hilangkan splash screen)
if (typeof sdk !== "undefined" && sdk.actions && sdk.actions.ready) {
  sdk.actions.ready();
}
