// app.js
// Farcaster Miniapp SDK is loaded globally via CDN in index.html
// <script src="https://unpkg.com/@farcaster/miniapp-sdk/dist/browser.js"></script>

const sdk = window.farcaster;
let currentUser = null;
let currentBlock = null;
let roundNumber = 1;
let winStreak = 0;
let userWins = 0;
let players = [];

/* === SDK Initialization === */
async function initializeFarcasterSDK() {
  try {
    await sdk.init(); // ✅ fixed init
    console.log("✅ Farcaster Miniapp initialized");

    currentUser = await sdk.user.getCurrent();
    if (currentUser) {
      document.getElementById("userInfo").style.display = "block";
      document.getElementById("userName").textContent = currentUser.username;
      document.getElementById("userFid").textContent = currentUser.fid;
    }

    // Start game once SDK is ready
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
    document.querySelector(".container").classList.remove("hidden");
    document.getElementById("loadingScreen").classList.add("hidden");
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
    document.getElementById("currentBlockHeight").textContent =
      currentBlock.height;
    document.getElementById("estimatedTxCount").textContent =
      currentBlock.tx_count || "N/A";
  } catch (err) {
    console.error("⚠️ Block fetch error:", err);
    showError("Error fetching current block");
  }
}

async function fetchPreviousBlock() {
  try {
    if (!currentBlock) return;
    const response = await fetch(
      `https://mempool.space/api/block-height/${currentBlock.height - 1}`
    );
    const prevBlockHash = await response.text();
    const prevResponse = await fetch(
      `https://mempool.space/api/block/${prevBlockHash}`
    );
    const prevBlock = await prevResponse.json();

    document.getElementById("currentBlockHeight").textContent =
      prevBlock.height;
    document.getElementById("estimatedTxCount").textContent =
      prevBlock.tx_count || "N/A";
  } catch (err) {
    console.error("⚠️ Prev block error:", err);
    showError("Error fetching previous block");
  }
}

async function fetchNextBlock() {
  try {
    if (!currentBlock) return;
    const response = await fetch(
      `https://mempool.space/api/block-height/${currentBlock.height + 1}`
    );
    const nextBlockHash = await response.text();
    const nextResponse = await fetch(
      `https://mempool.space/api/block/${nextBlockHash}`
    );
    const nextBlock = await nextResponse.json();

    document.getElementById("currentBlockHeight").textContent =
      nextBlock.height;
    document.getElementById("estimatedTxCount").textContent =
      nextBlock.tx_count || "N/A";
  } catch (err) {
    console.error("⚠️ Next block error:", err);
    showError("Error fetching next block");
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
  list.innerHTML = "";

  // Remove skeleton shimmer when real data is added
  list.classList.remove("skeleton");

  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `FID ${p.fid}: ${p.guess}`;
    list.appendChild(li);
  });

  document.getElementById("playersCount").textContent = players.length;
}

/* === Chat === */
document.getElementById("sendMessage")?.addEventListener("click", () => {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  const chatBox = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.textContent = `${currentUser?.username || "Anon"}: ${msg}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
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
  document.querySelector(".container")?.classList.add("hidden");
  const err = document.getElementById("errorScreen");
  if (err) {
    document.getElementById("errorMessage").textContent = msg;
    err.classList.remove("hidden");
  }
}

/* === Start App === */
window.addEventListener("load", () => {
  initializeFarcasterSDK();
});
