// ================================
// FRONTEND LOGIC: TX Battle Royale
// ================================

// -------------------------
// SOCKET CONNECTION
// -------------------------
const socket = io(window.BACKEND_URL);

// -------------------------
// UI ELEMENTS
// -------------------------
const joinBtn = document.getElementById("joinBtn");
const shareBtn = document.getElementById("shareBtn");
const prevBlockBtn = document.getElementById("prevBlockBtn");
const currBlockBtn = document.getElementById("currBlockBtn");
const predictionInput = document.getElementById("predictionInput");
const submitPredictionBtn = document.getElementById("submitPredictionBtn");

const playersDiv = document.getElementById("playersContainer");
const playerCount = document.getElementById("playerCount");

const chatBox = document.getElementById("messagesList");
const chatInput = document.getElementById("chatInput");
const chatForm = document.getElementById("chatForm");

const leaderboardDiv = document.getElementById("leaderboardContainer");
const connectWalletBtn = document.getElementById("connectWalletBtn");

const statusEl = document.getElementById("status");
function updateStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// -------------------------
// JOIN GAME
// -------------------------
joinBtn.addEventListener("click", () => {
  const fid = prompt("Masukkan FID Farcaster kamu:");
  if (fid) {
    socket.emit("join", { fid });
  }
});

socket.on("user_data", (user) => {
  addPlayerToUI(user);
});

socket.on("players", (players) => {
  playersDiv.innerHTML = "";
  players.forEach(addPlayerToUI);
  playerCount.textContent = `(${players.length})`;
});

function addPlayerToUI(user) {
  playersDiv.innerHTML += `
    <li class="player">
      <img src="${user.pfp_url}" width="32" height="32" style="border-radius:50%;" />
      <span>@${user.username} (${user.display_name})</span>
    </li>
  `;
}

// -------------------------
// CHAT
// -------------------------
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit("chat_message", msg);
    chatInput.value = "";
  }
});

socket.on("chat_message", (msg) => {
  chatBox.innerHTML += `<div class="chat-line">${msg}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
});

// -------------------------
// PREDICTION
// -------------------------
submitPredictionBtn.addEventListener("click", () => {
  const value = predictionInput.value.trim();
  if (value) {
    socket.emit("prediction", { value });
    predictionInput.value = "";
  }
});

// -------------------------
// CONTROLS
// -------------------------
shareBtn.addEventListener("click", () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert("Link copied to clipboard!");
  });
});

prevBlockBtn.addEventListener("click", () => {
  socket.emit("prev_block");
});

currBlockBtn.addEventListener("click", () => {
  socket.emit("curr_block");
});

// -------------------------
// LEADERBOARD
// -------------------------
socket.on("leaderboard", (data) => {
  leaderboardDiv.innerHTML = "";
  data.forEach((entry) => {
    leaderboardDiv.innerHTML += `
      <li>@${entry.username}: ${entry.score}</li>
    `;
  });
});

// -------------------------
// FARCASTER WALLET & SDK
// -------------------------
let farcasterSdk = null;

// Initialize Farcaster SDK when page loads
async function initializeFarcasterSDK() {
  try {
    // Check if we're in a Farcaster context and SDK is available
    if (window.farcasterSdk) {
      farcasterSdk = window.farcasterSdk;
      console.log("✅ Farcaster SDK initialized");
      return true;
    }
  } catch (err) {
    console.warn("Farcaster SDK not available:", err);
  }
  return false;
}

// Call ready() to hide splash screen - this is critical!
async function callSDKReady() {
  try {
    if (farcasterSdk && farcasterSdk.actions && farcasterSdk.actions.ready) {
      await farcasterSdk.actions.ready();
      console.log("✅ Called sdk.actions.ready() - splash should be hidden");
      return true;
    }
  } catch (err) {
    console.warn("Failed to call sdk.actions.ready():", err);
  }
  return false;
}

async function connectFarcaster() {
  try {
    if (!farcasterSdk) {
      await initializeFarcasterSDK();
    }
    
    if (!farcasterSdk || !farcasterSdk.actions) {
      alert("❌ Farcaster SDK not available. This app works best in Farcaster client.");
      return;
    }
    
    // Use the new SDK actions pattern
    const res = await farcasterSdk.actions.connect();
    const { fid, username, custodyAddress } = res.user;

    alert(`✅ Connected as @${username}\nFID: ${fid}\nWallet: ${custodyAddress}`);

    // Auto-join game with Farcaster FID
    socket.emit("join", { fid });

    // Sign welcome message using new SDK pattern
    const message = `Welcome to ${window.APP_NAME}!\nTime: ${new Date().toISOString()}`;
    const signed = await farcasterSdk.actions.signMessage(message);

    alert(`✅ Signed!\nMessage: ${message}\n\nSignature: ${signed}`);
  } catch (err) {
    console.error("Farcaster connect error:", err);
    alert("❌ Failed to connect Farcaster wallet");
  }
}

connectWalletBtn.addEventListener("click", connectFarcaster);

// -------------------------
// SPLASH CONTROL & SDK READY
// -------------------------
let isAppReady = false;

async function hideSplashAndShowGame() {
  if (isAppReady) return;
  
  isAppReady = true;
  
  // Initialize Farcaster SDK first
  await initializeFarcasterSDK();
  
  // Hide the splash screen in the DOM
  document.getElementById("splashScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "block";
  
  // CRITICAL: Call sdk.actions.ready() to hide Farcaster splash screen
  const readySuccess = await callSDKReady();
  if (readySuccess) {
    updateStatus("Farcaster SDK Ready ✅");
  } else {
    updateStatus("App Ready ✅");
  }
  
  console.log("✅ App fully loaded and ready");
}

socket.on("connect", async () => {
  updateStatus("Socket Connected");
  await hideSplashAndShowGame();
});

socket.on("disconnect", () => {
  updateStatus("Socket Disconnected ❌");
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  updateStatus("Initializing...");
  
  // Try to connect socket, but don't wait too long
  setTimeout(async () => {
    if (!isAppReady) {
      updateStatus("Loading complete");
      await hideSplashAndShowGame();
    }
  }, 2000); // Reduced timeout for faster loading
});

// Fallback timeout for safety
setTimeout(async () => {
  if (!isAppReady) {
    updateStatus("Loaded (fallback)");
    await hideSplashAndShowGame();
  }
}, 5000);