// app.js
const sdk = window.farcaster;
let currentUser = null;
let currentBlock = null;
let players = [];
let lastUpdateTime = null; // track block fetch timestamp

/* === SDK Initialization === */
async function initializeFarcasterSDK() {
  try {
    await sdk.init();
    console.log("✅ Farcaster Miniapp initialized");

    currentUser = await sdk.user.getCurrent();
    if (currentUser) {
      const userInfo = document.getElementById("userInfo");
      if (userInfo) userInfo.style.display = "block";
      const userName = document.getElementById("userName");
      if (userName) userName.textContent = currentUser.username;
      const userFid = document.getElementById("userFid");
      if (userFid) userFid.textContent = currentUser.fid;
    }

    connectToBitcoinNetwork();
  } catch (err) {
    console.error("❌ SDK Init failed:", err);
    showError("Failed to initialize Farcaster Miniapp SDK");
  }
}

/* === Bitcoin Data Fetch === */
function connectToBitcoinNetwork() {
  try {
    fetchCurrentBlock();
    setInterval(fetchCurrentBlock, 30000); // refresh every 30s
    setInterval(updateTimeAgo, 1000); // refresh "time ago" every second

    // hide loading and show app container
    document.getElementById("loadingScreen")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
  } catch (err) {
    console.error("⚠️ Bitcoin connection error:", err);
    showError("Failed to connect to Bitcoin network");
  }
}

async function fetchCurrentBlock() {
  try {
    const response = await fetch("https://mempool.space/api/blocks");
    const blocks = await response.json();
    currentBlock = blocks[0];

    // ✅ Update live ticker
    updateStatusTicker(currentBlock);

    // ✅ Remove skeleton shimmer
    removeLeaderboardSkeleton();

    // ✅ Track update time
    lastUpdateTime = Date.now();

  } catch (err) {
    console.error("⚠️ Block fetch error:", err);
    showError("Error fetching current block");
  }
}

/* === Status Ticker === */
function updateStatusTicker(block) {
  const statusEl = document.getElementById("status");
  if (statusEl && block) {
    statusEl.innerHTML = `
      📦 Live Block: ${block.height} | ${block.tx_count} TXs
      <div id="timeAgo" style="font-size:0.9rem; color:#aaa; margin-top:4px;">
        updated just now
      </div>
    `;
  }
}

/* === "Last updated X seconds ago" updater === */
function updateTimeAgo() {
  if (!lastUpdateTime) return;
  const timeAgoEl = document.getElementById("timeAgo");
  if (!timeAgoEl) return;

  const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
  if (seconds < 5) {
    timeAgoEl.textContent = "updated just now";
  } else if (seconds < 60) {
    timeAgoEl.textContent = `updated ${seconds} seconds ago`;
  } else {
    const mins = Math.floor(seconds / 60);
    timeAgoEl.textContent = `updated ${mins} minute${mins > 1 ? "s" : ""} ago`;
  }
}

/* === Predictions === */
document
  .getElementById("submitPrediction")
  ?.addEventListener("click", () => {
    const input = document.getElementById("predictionInput");
    const guess = parseInt(input.value);
    if (isNaN(guess) || guess <= 0) {
      alert("Enter a valid prediction");
      return;
    }
    players.push({ fid: currentUser?.fid || "anon", guess });
    updatePlayersList();
    input.value = "";
  });

function updatePlayersList() {
  const list = document.getElementById("playersList");
  if (!list) return;
  list.innerHTML = "";

  list.classList.remove("skeleton");

  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `FID ${p.fid}: ${p.guess}`;
    list.appendChild(li);
  });

  const countEl = document.getElementById("playersCount");
  if (countEl) countEl.textContent = players.length;
}

/* === Remove Skeleton Utility === */
function removeLeaderboardSkeleton() {
  const list = document.getElementById("leaderboardList");
  if (list) {
    list.querySelectorAll("li").forEach((li) => li.classList.remove("skeleton"));
  }
}

/* === Chat === */
document.getElementById("sendMessage")?.addEventListener("click", () => {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  const chatBox = document.getElementById("chatMessages");
  if (chatBox) {
    const div = document.createElement("div");
    div.textContent = `${currentUser?.username || "Anon"}: ${msg}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
  input.value = "";
});

/* === Social Sharing === */
function shareGame() {
  try {
    sdk.share({
      title: "TX Battle Royale 🎮",
      url: "https://testtx.netlify.app",
      text: "Join me in predicting Bitcoin blocks on Farcaster!"
    });
  } catch (err) {
    console.error("⚠️ Share error:", err);
    alert("Sharing not supported");
  }
}

function shareWin() {
  try {
    sdk.share({
      title: "🏆 I won in TX Battle Royale!",
      url: "https://testtx.netlify.app",
      text: "Beat my streak predicting Bitcoin blocks!"
    });
  } catch (err) {
    console.error("⚠️ Share error:", err);
    alert("Sharing not supported");
  }
}

/* === Error Handling === */
function showError(msg) {
  document.getElementById("loadingScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.add("hidden");
  const err = document.getElementById("errorScreen");
  if (err) {
    document.getElementById("errorMessage").textContent = msg;
    err.classList.remove("hidden");
  }
}

/* === Join Battle Button === */
document.getElementById("joinButton")?.addEventListener("click", () => {
  console.log("🚀 Join Battle clicked!");

  // 1️⃣ Show game UI
  const gameUI = document.getElementById("gameUI");
  if (gameUI) {
    gameUI.classList.remove("hidden");
    gameUI.scrollIntoView({ behavior: "smooth" });
  }

  // 2️⃣ Try launching Farcaster Miniapp (if inside Warpcast)
  try {
    if (sdk?.launch) {
      sdk.launch();
      console.log("✅ Farcaster miniapp launch triggered");
    } else {
      console.log("ℹ️ Not inside Farcaster (skipping sdk.launch)");
    }
  } catch (err) {
    console.error("❌ Join Battle launch failed:", err);
  }
});

/* === Start App === */
window.addEventListener("load", () => {
  initializeFarcasterSDK();
});