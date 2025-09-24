// =====================
// TX Battle Royale App
// =====================

// Global state
let socket;
let isAppReady = false;
let playerName = "";
let predictions = [];

// =====================
// Farcaster SDK Helpers
// =====================
async function initializeFarcasterSDK() {
  let sdkInstance = null;
  try {
    if (window.farcasterSdk) {
      sdkInstance = window.farcasterSdk;
      console.log("✅ Using window.farcasterSdk");
    } else if (window.FarcasterMiniapp) {
      sdkInstance = window.FarcasterMiniapp;
      console.log("✅ Using window.FarcasterMiniapp");
    } else if (window.miniapp) {
      sdkInstance = window.miniapp;
      console.log("✅ Using window.miniapp");
    } else {
      console.warn("⚠️ No Farcaster SDK found in window");
    }
  } catch (e) {
    console.error("❌ SDK init error", e);
  }
  return sdkInstance;
}

async function callSDKReady() {
  try {
    const sdk = await initializeFarcasterSDK();
    if (sdk && sdk.actions && sdk.actions.ready) {
      await sdk.actions.ready();
      console.log("✅ Farcaster SDK ready() called");
    } else if (sdk && sdk.ready) {
      await sdk.ready();
      console.log("✅ Farcaster legacy ready() called");
    } else {
      console.warn("⚠️ No ready() function found in SDK");
    }
  } catch (err) {
    console.error("❌ SDK ready error", err);
  }
}

async function hideSplashAndShowGame() {
  try {
    document.getElementById("splashScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "block";
    await callSDKReady();
    isAppReady = true;
    console.log("✅ Game screen displayed, splash hidden");
  } catch (e) {
    console.error("❌ Error showing game screen", e);
  }
}

// =====================
// UI Updates
// =====================
function updateStatus(msg) {
  const el = document.getElementById("statusMessage");
  if (el) el.textContent = msg;
}

function addChatMessage(author, message) {
  const chatMessages = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "chat-message";
  div.innerHTML = `<strong>${author}:</strong> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// =====================
// Socket Events
// =====================
function setupSocket() {
  socket = io();

  socket.on("connect", () => {
    console.log("🔌 Socket connected");
    updateStatus("Connected to server ✅");
    hideSplashAndShowGame();
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected");
    updateStatus("Disconnected ❌");
  });

  socket.on("chatMessage", (data) => {
    addChatMessage(data.author, data.message);
  });

  socket.on("playerList", (list) => {
    const container = document.getElementById("playersContainer");
    container.innerHTML = "";
    list.forEach((p) => {
      const div = document.createElement("div");
      div.textContent = p;
      container.appendChild(div);
    });
    document.getElementById("playerCount").textContent = `${list.length} players joined`;
  });

  socket.on("leaderboard", (board) => {
    const ul = document.getElementById("leaderboardList");
    ul.innerHTML = "";
    board.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.player} - ${entry.score}`;
      ul.appendChild(li);
    });
  });
}

// =====================
// Event Listeners
// =====================
function setupEventListeners() {
  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      playerName = `Player-${Math.floor(Math.random() * 1000)}`;
      socket.emit("join", playerName);
      updateStatus(`Joined as ${playerName}`);
    });
  }

  const chatSendBtn = document.getElementById("chatSendBtn");
  if (chatSendBtn) {
    chatSendBtn.addEventListener("click", () => {
      const input = document.getElementById("chatInput");
      if (input.value.trim() !== "") {
        socket.emit("chatMessage", { author: playerName, message: input.value });
        input.value = "";
      }
    });
  }

  const submitPredictionBtn = document.getElementById("submitPredictionBtn");
  if (submitPredictionBtn) {
    submitPredictionBtn.addEventListener("click", () => {
      const input = document.getElementById("predictionInput");
      const val = parseInt(input.value, 10);
      if (!isNaN(val)) {
        predictions.push(val);
        socket.emit("prediction", { player: playerName, value: val });
        updateStatus(`Prediction submitted: ${val}`);
        input.value = "";
      }
    });
  }

  const connectWalletBtn = document.getElementById("connectWalletBtn");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", async () => {
      try {
        const sdk = await initializeFarcasterSDK();
        if (sdk?.wallet?.connect) {
          await sdk.wallet.connect();
          updateStatus("Wallet connected ✅");
        } else {
          alert("Wallet connect not available");
        }
      } catch (e) {
        console.error("❌ Wallet connect error", e);
        updateStatus("Wallet connection failed ❌");
      }
    });
  }
}

// =====================
// Init
// =====================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 DOM loaded, initializing app...");
  updateStatus("Initializing...");

  // ✅ panggil SDK ready lebih awal supaya splash screen di Farcaster hilang
  try {
    await callSDKReady();
  } catch (e) {
    console.warn("⚠️ early ready() failed", e);
  }

  setupSocket();
  setupEventListeners();

  // fallback jaga-jaga
  setTimeout(async () => {
    if (!isAppReady) {
      updateStatus("Forcing UI ready...");
      await hideSplashAndShowGame();
    }
  }, 5000);
});
