// app.js
const sdk = window.farcaster;
let currentUser = null;
let currentBlock = null;
let players = [];
let lastUpdateTime = null; // Track block fetch timestamp

async function initializeFarcasterSDK() {
  try {
    await sdk.init();
    console.log("✅ Farcaster Miniapp initialized");

    currentUser = await sdk.user.getCurrent();
    if (currentUser) {
      document.getElementById("userInfo").style.display = "block";
      document.getElementById("userName").textContent = currentUser.username;
      document.getElementById("userFid").textContent = currentUser.fid;
    }

    connectToBitcoinNetwork();
  } catch (err) {
    console.error("❌ SDK initialization failed:", err);
    showError("Failed to initialize Farcaster Miniapp SDK");
  }
}

function connectToBitcoinNetwork() {
  try {
    fetchCurrentBlock();
    setInterval(fetchCurrentBlock, 30000); // Refresh every 30 seconds
    setInterval(updateTimeAgo, 1000); // Update "time ago" every second

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

    document.getElementById("currentBlockHeight").textContent = currentBlock.height;
    document.getElementById("estimatedTxCount").textContent = currentBlock.tx_count || "N/A";

    updateStatusTicker(currentBlock);
    removeLeaderboardSkeleton();
    lastUpdateTime = Date.now();
  } catch (err) {
    console.error("⚠️ Block fetch error:", err);
    showError("Error fetching current block");
  }
}

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

document
  .getElementById("submitPrediction")
  ?.addEventListener("click", () => {
    const input = document.getElementById("predictionInput");
    const guess = parseInt(input.value);
    if (isNaN(guess) || guess <= 0) {
      alert("Please enter a valid prediction (positive number).");
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

  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `FID ${player.fid}: ${player.guess}`;
    list.appendChild(li);
  });

  document.getElementById("playersCount")?.textContent = players.length;
}

function removeLeaderboardSkeleton() {
  const list = document.getElementById("leaderboardList");
  if (list) {
    list.querySelectorAll("li").forEach((li) => li.classList.remove("skeleton"));
  }
}

document.getElementById("sendMessage")?.addEventListener("click", () => {
  const input = document.getElementById("chatInput");
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

function showError(msg) {
  document.getElementById("loadingScreen")?.classList.add("hidden");
  document.getElementById("app")?.classList.add("hidden");
  const err = document.getElementById("errorScreen");
  if (err) {
    document.getElementById("errorMessage")?.textContent = msg;
    err.classList.remove("hidden");
  }
}

window.addEventListener("load", () => {
  initializeFarcasterSDK();
});
