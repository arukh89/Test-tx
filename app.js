// ================================
// FRONTEND LOGIC: TX Battle Royale (Hardened & Backward-compatible)
// ================================

// SOCKET CONNECTION
const socket = (typeof io !== "undefined") ? io(window.BACKEND_URL) : null;
if (!socket) console.warn("socket.io not available or not loaded yet.");

// Helper: try multiple IDs/selectors
function getElByIds(...ids) {
  for (const id of ids) {
    if (!id) continue;
    // if passed with # prefix, try querySelector; otherwise getElementById
    if (id.startsWith("#")) {
      const el = document.querySelector(id);
      if (el) return el;
    } else {
      const el = document.getElementById(id);
      if (el) return el;
    }
  }
  return null;
}

// -------------------------
// UI ELEMENTS (try multiple possible ids to avoid mismatch)
const joinBtn = getElByIds("joinBtn");
const shareBtn = getElByIds("shareBtn");
const prevBlockBtn = getElByIds("prevBlockBtn");
const currBlockBtn = getElByIds("currBlockBtn");
const predictionInput = getElByIds("predictionInput");
const submitPredictionBtn = getElByIds("submitPredictionBtn");

const playersDiv = getElByIds("playersContainer", "players");
const playerCount = getElByIds("playerCount");

const chatBox = getElByIds("messagesList", "chatMessages", "chatBox");
const chatInput = getElByIds("chatInput");
const chatForm = getElByIds("chatForm");
const chatSendBtn = getElByIds("chatSendBtn", "chatSend", "chatSubmit");

const leaderboardDiv = getElByIds("leaderboardContainer", "leaderboardList");
const connectWalletBtn = getElByIds("connectWalletBtn");

const statusEl = getElByIds("status", "statusMessage");

// Safe updateStatus
function updateStatus(msg) {
  try {
    if (statusEl) statusEl.textContent = msg;
    else console.log("[status]", msg);
  } catch (e) {
    console.error("updateStatus error:", e);
  }
}

// Helper to append HTML safely
function appendHTML(container, html) {
  try {
    if (!container) return;
    container.insertAdjacentHTML("beforeend", html);
  } catch (e) {
    console.error("appendHTML error:", e);
  }
}

// -------------------------
// JOIN GAME
if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    try {
      const fid = prompt("Masukkan FID Farcaster kamu:");
      if (fid && socket) {
        socket.emit("join", { fid });
      }
    } catch (e) {
      console.error("joinBtn click error:", e);
    }
  });
} else {
  console.warn("joinBtn not found in DOM");
}

// Player UI helper
function addPlayerToUI(user) {
  try {
    if (!playersDiv) return;
    // keep markup consistent with existing UI (use divs if container is div)
    const markup = `
      <div class="player">
        <img src="${user.pfp_url || ''}" width="32" height="32" style="border-radius:50%;" />
        <span>@${user.username || ''} ${user.display_name ? `(${user.display_name})` : ""}</span>
      </div>
    `;
    appendHTML(playersDiv, markup);
  } catch (e) {
    console.error("addPlayerToUI error:", e);
  }
}

// socket players update
if (socket) {
  socket.on("players", (players) => {
    try {
      if (playersDiv) playersDiv.innerHTML = "";
      (players || []).forEach((p) => addPlayerToUI(p));
      if (playerCount) playerCount.textContent = `(${(players || []).length})`;
    } catch (e) {
      console.error("players handler error:", e);
    }
  });

  socket.on("user_data", (user) => {
    try {
      addPlayerToUI(user);
    } catch (e) {
      console.error("user_data handler error:", e);
    }
  });
}

// -------------------------
// CHAT: support both form submit or button click (defensive)
if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const msg = (chatInput && chatInput.value) ? chatInput.value.trim() : "";
      if (msg && socket) {
        socket.emit("chat_message", msg);
        if (chatBox) appendHTML(chatBox, `<div class="chat-line">${escapeHtml(msg)}</div>`);
        if (chatInput) chatInput.value = "";
      }
    } catch (err) {
      console.error("chatForm submit error:", err);
    }
  });
} else if (chatSendBtn) {
  chatSendBtn.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const msg = (chatInput && chatInput.value) ? chatInput.value.trim() : "";
      if (msg && socket) {
        socket.emit("chat_message", msg);
        if (chatBox) appendHTML(chatBox, `<div class="chat-line">${escapeHtml(msg)}</div>`);
        if (chatInput) chatInput.value = "";
      }
    } catch (err) {
      console.error("chatSendBtn click error:", err);
    }
  });
} else {
  console.warn("No chat form or send button found; chat input may not be usable.");
}

// helper escape to prevent possible markup injection from messages
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, function (m) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m];
  });
}

// socket chat_message handler
if (socket) {
  socket.on("chat_message", (msg) => {
    try {
      if (chatBox) {
        appendHTML(chatBox, `<div class="chat-line">${escapeHtml(msg)}</div>`);
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    } catch (e) {
      console.error("chat_message handler error:", e);
    }
  });
}

// -------------------------
// PREDICTION
if (submitPredictionBtn) {
  submitPredictionBtn.addEventListener("click", () => {
    try {
      const value = predictionInput ? predictionInput.value.trim() : "";
      if (value && socket) {
        socket.emit("prediction", { value });
        if (predictionInput) predictionInput.value = "";
      }
    } catch (e) {
      console.error("submitPredictionBtn click error:", e);
    }
  });
} else {
  console.warn("submitPredictionBtn not found");
}

// -------------------------
// CONTROLS
if (shareBtn) {
  shareBtn.addEventListener("click", () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        alert("Link copied to clipboard!");
      }).catch((err) => {
        console.warn("copy failed:", err);
      });
    } catch (e) {
      console.error("shareBtn click error:", e);
    }
  });
}

if (prevBlockBtn && socket) {
  prevBlockBtn.addEventListener("click", () => { socket.emit("prev_block"); });
}
if (currBlockBtn && socket) {
  currBlockBtn.addEventListener("click", () => { socket.emit("curr_block"); });
}

// -------------------------
// LEADERBOARD
if (socket) {
  socket.on("leaderboard", (data) => {
    try {
      if (!leaderboardDiv) return;
      // if it's a <ul>, render <li>, otherwise render <div> items
      const isList = leaderboardDiv.tagName && leaderboardDiv.tagName.toLowerCase() === "ul";
      leaderboardDiv.innerHTML = "";
      (data || []).forEach((entry) => {
        if (isList) {
          appendHTML(leaderboardDiv, `<li>@${entry.username}: ${entry.score}</li>`);
        } else {
          appendHTML(leaderboardDiv, `<div class="leader-item">@${entry.username}: ${entry.score}</div>`);
        }
      });
    } catch (e) {
      console.error("leaderboard handler error:", e);
    }
  });
}

// -------------------------
// FARCASTER WALLET & SDK
let farcasterSdk = null;

async function initializeFarcasterSDK() {
  try {
    // Primary: some Farcaster clients inject SDK to window.farcasterSdk
    if (window.farcasterSdk) {
      farcasterSdk = window.farcasterSdk;
      console.log("✅ Farcaster SDK found on window.farcasterSdk");
      return true;
    }
    // Secondary: some clients expose window.FarcasterMiniapp
    if (window.FarcasterMiniapp) {
      farcasterSdk = window.FarcasterMiniapp;
      console.log("✅ Farcaster SDK found on window.FarcasterMiniapp");
      return true;
    }
    // Last resort: sometimes the bundled module attaches a global 'miniapp'
    if (window.miniapp) {
      farcasterSdk = window.miniapp;
      console.log("✅ Farcaster SDK found on window.miniapp");
      return true;
    }
  } catch (err) {
    console.warn("initializeFarcasterSDK check error:", err);
  }
  return false;
}

// Try to call ready() using multiple flavors
async function callSDKReady() {
  try {
    if (farcasterSdk && farcasterSdk.actions && typeof farcasterSdk.actions.ready === "function") {
      await farcasterSdk.actions.ready();
      console.log("✅ Called farcasterSdk.actions.ready()");
      return true;
    }
    if (farcasterSdk && typeof farcasterSdk.ready === "function") {
      await farcasterSdk.ready();
      console.log("✅ Called farcasterSdk.ready()");
      return true;
    }
    if (window.FarcasterMiniapp && typeof window.FarcasterMiniapp.ready === "function") {
      await window.FarcasterMiniapp.ready();
      console.log("✅ Called window.FarcasterMiniapp.ready()");
      return true;
    }
  } catch (err) {
    console.warn("callSDKReady failed:", err);
  }
  return false;
}

async function connectFarcaster() {
  try {
    if (!farcasterSdk) await initializeFarcasterSDK();

    if (!farcasterSdk || !farcasterSdk.actions) {
      alert("❌ Farcaster SDK not available. This app works best inside Farcaster client.");
      return;
    }

    const res = await farcasterSdk.actions.connect();
    const { fid, username, custodyAddress } = res.user || {};

    alert(`✅ Connected as @${username || "unknown"}\nFID: ${fid || "n/a"}\nWallet: ${custodyAddress || "n/a"}`);

    // Auto-join by fid
    if (fid && socket) socket.emit("join", { fid });

    // Sign a welcome message
    const message = `Welcome to ${window.APP_NAME || "TX Battle"}!\nTime: ${new Date().toISOString()}`;
    if (farcasterSdk.actions && typeof farcasterSdk.actions.signMessage === "function") {
      const signed = await farcasterSdk.actions.signMessage(message);
      alert(`✅ Signed!\nMessage: ${message}\n\nSignature: ${signed}`);
    } else if (typeof farcasterSdk.signMessage === "function") {
      const signed = await farcasterSdk.signMessage(message);
      alert(`✅ Signed!\nMessage: ${message}\n\nSignature: ${signed}`);
    } else {
      console.warn("signMessage not available on SDK");
    }
  } catch (err) {
    console.error("Farcaster connect error:", err);
    alert("❌ Failed to connect Farcaster wallet");
  }
}

// connect wallet button
if (connectWalletBtn) {
  connectWalletBtn.addEventListener("click", connectFarcaster);
} else {
  console.warn("connectWalletBtn not found");
}

// -------------------------
// SPLASH CONTROL & SDK READY
let isAppReady = false;

async function hideSplashAndShowGame() {
  if (isAppReady) return;
  isAppReady = true;

  try {
    // Try to initialize Farcaster SDK (non-blocking)
    await initializeFarcasterSDK();
  } catch (e) {
    console.warn("init sdk error:", e);
  }

  // Hide splash / show UI safely
  try {
    const splash = getElByIds("splashScreen");
    const game = getElByIds("gameScreen");
    if (splash) splash.style.display = "none";
    if (game) game.style.display = "block";
  } catch (e) {
    console.warn("hide/show DOM error:", e);
  }

  // Call SDK ready (best-effort)
  try {
    const ok = await callSDKReady();
    if (ok) updateStatus("Farcaster SDK Ready ✅");
    else updateStatus("App Ready ✅");
  } catch (e) {
    console.warn("callSDKReady error:", e);
    updateStatus("App Ready (no sdk)");
  }

  console.log("✅ App loaded and visible");
}

// socket connection events
if (socket) {
  socket.on("connect", async () => {
    updateStatus("Socket Connected");
    try { await hideSplashAndShowGame(); } catch (e) { console.error(e); }
  });

  socket.on("disconnect", () => {
    updateStatus("Socket Disconnected ❌");
  });
} else {
  // If no socket library (local testing), still try to show UI after timeout
  console.warn("Socket not initialized; running fallback show");
}

// DOM ready fallback logic
document.addEventListener("DOMContentLoaded", async () => {
  updateStatus("Initializing...");
  // Short timeout: if socket hasn't connected in short time, show UI anyway
  setTimeout(async () => {
    if (!isAppReady) {
      updateStatus("Loading complete");
      try { await hideSplashAndShowGame(); } catch (e) { console.error(e); }
    }
  }, 2000);
});

// Final safety fallback to ensure UI shows
setTimeout(async () => {
  if (!isAppReady) {
    updateStatus("Loaded (fallback)");
    try { await hideSplashAndShowGame(); } catch (e) { console.error(e); }
  }
}, 5000);
