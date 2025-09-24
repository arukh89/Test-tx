// -------------------- Globals --------------------
let socket;
let isConnected = false;
let userFid = null;
let userProfile = null;

// -------------------- DOM Elements --------------------
const splashScreen = document.getElementById("splashScreen");
const gameScreen = document.getElementById("gameScreen");

const joinBtn = document.getElementById("joinBtn");
const submitPredictionBtn = document.getElementById("submitPredictionBtn");
const predictionInput = document.getElementById("predictionInput");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const shareBtn = document.getElementById("shareBtn");
const prevBlockBtn = document.getElementById("prevBlockBtn");
const currBlockBtn = document.getElementById("currBlockBtn");
const connectWalletBtn = document.getElementById("connectWalletBtn");
const signMessageBtn = document.getElementById("signMessageBtn");

// containers
const playersContainer = document.getElementById("playersContainer");
const leaderboardContainer = document.getElementById("leaderboardContainer");
const messagesList = document.getElementById("messagesList");
const playerCountEl = document.getElementById("playerCount");
const currentBlockEl = document.getElementById("currentBlock");
const statusEl = document.getElementById("status");

// -------------------- UI Helpers --------------------
function showScreen(screen) {
  if (screen === "splash") {
    splashScreen.classList.add("active");
    gameScreen.classList.add("hidden");
  } else if (screen === "game") {
    splashScreen.classList.remove("active");
    gameScreen.classList.remove("hidden");
  }
}

function updateStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "tomato" : "var(--muted)";
}

function renderPlayers(players) {
  playersContainer.innerHTML = "";
  if (!players || players.length === 0) {
    playersContainer.innerHTML = `<li class="muted">No players yet</li>`;
  } else {
    players.forEach(p => {
      const li = document.createElement("li");
      li.className = "player-item";
      li.textContent = `${p.name || p.fid}: ${p.prediction}`;
      playersContainer.appendChild(li);
    });
  }
  playerCountEl.textContent = `(${players?.length || 0})`;
}

function renderLeaderboard(entries) {
  leaderboardContainer.innerHTML = "";
  if (!entries || entries.length === 0) {
    leaderboardContainer.innerHTML = `<li class="muted">No data</li>`;
  } else {
    entries.forEach(e => {
      const li = document.createElement("li");
      li.className = "leader-item";
      li.textContent = `${e.name || e.fid}: ${e.score}`;
      leaderboardContainer.appendChild(li);
    });
  }
}

function renderBlock(block) {
  currentBlockEl.innerHTML = "";
  if (!block) {
    currentBlockEl.innerHTML = `<div class="muted">No block yet</div>`;
  } else {
    currentBlockEl.innerHTML = `
      <div>Height: ${block.height}</div>
      <div>Tx Count: ${block.txCount}</div>
      <div>Hash: ${block.hash.slice(0,16)}...</div>
    `;
  }
}

function appendChatMessage(msg) {
  const div = document.createElement("div");
  div.className = "chat-item";
  div.innerHTML = `<strong>${msg.from}</strong>: ${msg.text}`;
  messagesList.appendChild(div);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// -------------------- Socket --------------------
function connectSocket() {
  if (!BACKEND_URL) {
    console.error("BACKEND_URL not defined!");
    return;
  }

  socket = io(BACKEND_URL, {
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    isConnected = true;
    console.log("✅ Connected to backend");
    updateStatus("Connected");
    showScreen("game");
  });

  socket.on("disconnect", () => {
    isConnected = false;
    console.warn("❌ Disconnected from backend");
    updateStatus("Disconnected", true);
  });

  socket.on("players", renderPlayers);
  socket.on("leaderboard", renderLeaderboard);
  socket.on("chat_message", appendChatMessage);
  socket.on("block_update", renderBlock);
}

// -------------------- Game Actions --------------------
function joinGame() {
  if (!socket || !isConnected) {
    updateStatus("Not connected", true);
    return;
  }
  const fid = prompt("Enter your Farcaster FID or username");
  if (!fid) return;
  userFid = fid;
  userProfile = { name: fid };
  socket.emit("join", { fid });
}

function submitPrediction() {
  if (!socket || !isConnected) {
    updateStatus("Not connected", true);
    return;
  }
  const val = parseInt(predictionInput.value, 10);
  if (isNaN(val)) {
    updateStatus("Invalid prediction", true);
    return;
  }
  socket.emit("prediction", { fid: userFid, value: val });
  predictionInput.value = "";
}

function sendChat(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!socket || !isConnected) {
    updateStatus("Not connected", true);
    return;
  }
  const txt = chatInput ? chatInput.value : "";
  if (!txt) return;
  const payload = { fid: userFid, text: txt, timestamp: Date.now() };
  socket.emit("chat_message", payload);
  appendChatMessage({ from: userProfile?.name || userFid || "me", text: txt, timestamp: Date.now() });
  if (chatInput) chatInput.value = "";
}

// -------------------- Wallet Connect --------------------
async function connectEvmWallet() {
  try {
    if (window.sdk && window.sdk.wallet && typeof window.sdk.wallet.connect === "function") {
      const walletInfo = await window.sdk.wallet.connect({ chainId: "8453" });
      console.log("✅ Wallet connected via Farcaster:", walletInfo);
      updateStatus(`Wallet connected: ${walletInfo.address}`);
      return walletInfo;
    }

    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      console.log("✅ Wallet connected via injected wallet:", accounts[0], chainId);
      updateStatus(`Wallet connected: ${accounts[0]} on chain ${chainId}`);
      return { address: accounts[0], chainId };
    }

    updateStatus("No wallet provider found", true);
    return null;
  } catch (err) {
    console.error("❌ Wallet connect failed", err);
    updateStatus("Wallet connect failed", true);
    return null;
  }
}

// -------------------- Sign Message --------------------
async function signMessageBase() {
  try {
    let dynamicMsg = `🚀 MiniApp Sign-in @ ${new Date().toLocaleString()}`;

    if (window.sdk && window.sdk.wallet && typeof window.sdk.wallet.signMessage === "function") {
      const sig = await window.sdk.wallet.signMessage({ message: dynamicMsg });
      console.log("✅ Signed via Farcaster SDK:", sig);
      updateStatus("🎉 Message signed successfully!");
      return sig;
    }

    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const from = accounts[0];
      dynamicMsg = `✨ Proof for ${from} @ ${new Date().toLocaleTimeString()}`;
      const sig = await window.ethereum.request({
        method: "personal_sign",
        params: [dynamicMsg, from],
      });
      console.log("✅ Signed via injected wallet:", sig);
      updateStatus("🎉 Message signed successfully!");
      return sig;
    }

    updateStatus("No wallet provider found", true);
    return null;
  } catch (err) {
    console.error("❌ Sign message failed", err);
    updateStatus("❌ Sign message failed", true);
    return null;
  }
}

// -------------------- Init --------------------
document.addEventListener("DOMContentLoaded", () => {
  if (joinBtn) joinBtn.addEventListener("click", joinGame);
  if (submitPredictionBtn) submitPredictionBtn.addEventListener("click", submitPrediction);
  if (chatForm) chatForm.addEventListener("submit", sendChat);
  if (shareBtn) shareBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(window.location.href)
      .then(() => updateStatus("Link copied"))
      .catch(() => updateStatus("Copy failed", true));
  });
  if (prevBlockBtn) prevBlockBtn.addEventListener("click", () => { socket && socket.emit("request_prev_block"); });
  if (currBlockBtn) currBlockBtn.addEventListener("click", () => { socket && socket.emit("request_current_block"); });
  if (connectWalletBtn) connectWalletBtn.addEventListener("click", connectEvmWallet);
  if (signMessageBtn) signMessageBtn.addEventListener("click", signMessageBase);

  updateStatus("Connecting...");
  connectSocket();
});

// -------------------- Farcaster Ready --------------------
try {
  const sdkCandidate = window.miniApp || window.sdk || (typeof MiniAppSDK !== "undefined" ? MiniAppSDK : undefined);
  if (sdkCandidate && sdkCandidate.actions && typeof sdkCandidate.actions.ready === "function") {
    sdkCandidate.actions.ready();
    console.log("[Farcaster] ready() called");
  }
} catch (e) { /* ignore */ }
