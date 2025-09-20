/* === TX BATTLE ROYALE - FARCASTER MINIAPP === */

// Global game state
let gameState = {
  blockHeight: 0,
  isRoundActive: false,
  players: [],
  currentUser: {
    fid: null,
    username: null,
    guess: null,
    wins: 0,
    streak: 0
  },
  round: 1,
  websocket: null,
  isSDKReady: false
};

/* === FARCASTER SDK INITIALIZATION === */
async function initializeFarcasterSDK() {
  console.log("🚀 Initializing Farcaster MiniApp...");

  try {
    const sdk = window.farcaster;
    window.farcasterSDK = sdk;

    let context;
    try {
      context = await sdk.context.get();
    } catch (err) {
      console.warn("⚠️ No user context, fallback to anonymous");
    }

    if (context?.user) {
      gameState.currentUser.fid = context.user.fid;
      gameState.currentUser.username =
        context.user.username || context.user.displayName || `user${context.user.fid}`;

      updateUserDisplay();
      addChatMessage("System", `@${gameState.currentUser.username} joined the battle! 🎯`, "system");
    } else {
      continueAnonymous();
    }

    await initializeGameComponents();
    await sdk.actions.ready();
    gameState.isSDKReady = true;

    hideLoadingScreen();
    await initializeGame();

  } catch (error) {
    console.error("❌ Failed to initialize Farcaster SDK:", error);
    handleSDKError(error);
  }
}

function generateAnonymousId() {
  return "anon_" + Math.random().toString(36).substr(2, 9);
}

function continueAnonymous() {
  gameState.currentUser.fid = generateAnonymousId();
  gameState.currentUser.username = "Anonymous";
  addChatMessage("System", "Anonymous player joined the battle! 👤", "system");
  initializeGame();
  hideLoadingScreen();
}

function updateUserDisplay() {
  const userInfo = document.getElementById("userInfo");
  const userName = document.getElementById("userName");
  const userFid = document.getElementById("userFid");

  if (userInfo && userName && userFid) {
    userName.textContent = gameState.currentUser.username;
    userFid.textContent = gameState.currentUser.fid;
    userInfo.style.display = "block";
  }
}

function hideLoadingScreen() {
  document.getElementById("loadingScreen")?.classList.add("hidden");
  const container = document.querySelector(".container");
  if (container) {
    container.classList.remove("hidden");
    container.style.opacity = "1";
    container.style.transform = "translateY(0)";
  }
}

function handleSDKError(error) {
  const errorScreen = document.getElementById("errorScreen");
  const errorMessage = document.getElementById("errorMessage");

  if (errorScreen) errorScreen.classList.remove("hidden");
  if (errorMessage) errorMessage.textContent = `SDK Error: ${error.message}`;
}

/* === GAME INITIALIZATION === */
async function initializeGameComponents() {
  setupEventListeners();
  loadGameState();
  updateGameStats();
  await new Promise(res => setTimeout(res, 100));
}

async function initializeGame() {
  loadGameState();
  updateGameStats();
  updatePlayersList();
  connectToBitcoinNetwork();
  addChatMessage("System", "🚀 TX Battle Royale initialized!", "system");
  updateGameStatus("🔄 Connecting to Bitcoin network...");
}

/* === EVENT LISTENERS === */
function setupEventListeners() {
  const predictionInput = document.getElementById("predictionInput");
  const submitButton = document.getElementById("submitPrediction");
  const chatInput = document.getElementById("chatInput");
  const sendButton = document.getElementById("sendMessage");

  if (submitButton) submitButton.onclick = submitGuess;
  if (predictionInput) {
    predictionInput.addEventListener("keypress", e => {
      if (e.key === "Enter") submitGuess();
    });
  }
  if (sendButton) sendButton.onclick = sendChatMessage;
  if (chatInput) {
    chatInput.addEventListener("keypress", e => {
      if (e.key === "Enter") sendChatMessage();
    });
  }
}

/* === BITCOIN CONNECTION === */
function connectToBitcoinNetwork() {
  if (gameState.websocket) gameState.websocket.close();

  gameState.websocket = new WebSocket("wss://mempool.space/api/v1/ws");

  gameState.websocket.onopen = () => {
    updateGameStatus("🟢 Connected to Bitcoin network. Waiting for next block...");
    fetchCurrentBlock();
  };

  gameState.websocket.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      handleWebSocketMessage(data);
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  };

  gameState.websocket.onerror = () => {
    updateGameStatus("❌ Connection error. Retrying...");
    setTimeout(connectToBitcoinNetwork, 5000);
  };

  gameState.websocket.onclose = () => {
    console.log("📡 Connection closed. Reconnecting...");
    setTimeout(connectToBitcoinNetwork, 3000);
  };
}

function handleWebSocketMessage(data) {
  if (data.block) handleNewBlock(data.block);
  if (data.mempoolInfo) updateEstimatedTransactions(data.mempoolInfo.count || "Unknown");
  if (data.txCount) updateEstimatedTransactions(data.txCount);
}

/* === BLOCK EXPLORER EXTRA FUNCTIONS === */
async function fetchBlockByHeight(height) {
  try {
    const block = await (await fetch(`https://mempool.space/api/block/${height}`)).json();
    const txCount = block.tx_count || "Unknown";

    updateCurrentBlockHeight(block.height);
    updateEstimatedTransactions(txCount);
    gameState.blockHeight = block.height;

    addChatMessage("System", `🔍 Viewed block ${block.height} (${txCount} txs)`, "system");
  } catch (err) {
    console.error("Error fetching block:", err);
    updateGameStatus("❌ Failed to fetch block data");
  }
}

async function fetchCurrentBlock() {
  try {
    const height = await (await fetch("https://mempool.space/api/blocks/tip/height")).text();
    await fetchBlockByHeight(height);
  } catch (err) {
    console.error("Error fetching current block:", err);
  }
}

async function fetchPreviousBlock() {
  if (!gameState.blockHeight || gameState.blockHeight <= 1) {
    alert("⚠️ No previous block available");
    return;
  }
  await fetchBlockByHeight(gameState.blockHeight - 1);
}

async function fetchNextBlock() {
  if (!gameState.blockHeight) {
    alert("⚠️ No block data yet");
    return;
  }
  await fetchBlockByHeight(gameState.blockHeight + 1);
}

/* === GAME LOGIC === */
function submitGuess() {
  const input = document.getElementById("predictionInput");
  const guess = parseInt(input.value);
  if (!guess || guess < 1) {
    alert("⚠️ Enter a valid prediction!");
    return;
  }

  gameState.currentUser.guess = guess;
  addChatMessage("System", `📩 @${gameState.currentUser.username} predicted ${guess}`, "system");
  input.value = "";

  updatePlayersList();
  saveGameState();
}

function handleNewBlock(block) {
  if (!block) return;

  gameState.blockHeight = block.height;
  updateCurrentBlockHeight(block.height);

  const txCount = block.tx_count || "Unknown";
  updateEstimatedTransactions(txCount);

  if (gameState.isRoundActive) {
    announceResults(txCount);
    startNewRound();
  } else {
    gameState.isRoundActive = true;
  }
}

function announceResults(txCount) {
  const winner = gameState.players.reduce((prev, player) => {
    if (!player.guess) return prev;
    return Math.abs(player.guess - txCount) < Math.abs(prev.guess - txCount) ? player : prev;
  }, gameState.players[0]);

  if (winner) {
    winner.wins++;
    winner.streak++;
    addChatMessage("System", `🏆 Winner: @${winner.username} with ${winner.guess} (Block ${gameState.blockHeight}, ${txCount} txs)`, "system");

    if (winner.fid === gameState.currentUser.fid) {
      gameState.currentUser.wins++;
      gameState.currentUser.streak++;
    }
  }

  updateGameStats();
  saveGameState();
}

function startNewRound() {
  gameState.round++;
  gameState.players.forEach(p => (p.guess = null));
  updatePlayersList();
  updateGameStats();
}

/* === UI HELPERS === */
function updateGameStatus(msg) {
  const el = document.getElementById("gameStatus");
  if (el) el.textContent = msg;
}

function updateCurrentBlockHeight(height) {
  const el = document.getElementById("currentBlockHeight");
  if (el) el.textContent = height;
}

function updateEstimatedTransactions(count) {
  const el = document.getElementById("estimatedTxCount");
  if (el) el.textContent = count;
}

function updateGameStats() {
  document.getElementById("roundNumber").textContent = gameState.round;
  document.getElementById("playersCount").textContent = gameState.players.length;
  document.getElementById("userWins").textContent = gameState.currentUser.wins;
  document.getElementById("winStreak").textContent = gameState.currentUser.streak;
}

function updatePlayersList() {
  const list = document.getElementById("playersList");
  const empty = document.getElementById("emptyPlayers");
  if (!list) return;

  list.innerHTML = "";
  gameState.players.forEach(player => {
    const li = document.createElement("li");
    li.textContent = `@${player.username} → ${player.guess || "No guess"}`;
    list.appendChild(li);
  });

  if (gameState.players.length > 0) {
    empty.style.display = "none";
  } else {
    empty.style.display = "block";
  }
}

/* === CHAT SYSTEM === */
function addChatMessage(user, msg, type = "user") {
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = type === "system" ? "chat-message system" : "chat-message";
  div.textContent = `[${user}] ${msg}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  addChatMessage(gameState.currentUser.username, msg);
  input.value = "";
}

/* === STORAGE === */
function saveGameState() {
  localStorage.setItem("txBattleState", JSON.stringify(gameState));
}

function loadGameState() {
  const data = localStorage.getItem("txBattleState");
  if (!data) return;
  try {
    gameState = JSON.parse(data);
  } catch (err) {
    console.error("Failed to parse saved state", err);
  }
}

/* === SOCIAL SHARING === */
function shareGame() {
  if (navigator.share) {
    navigator.share({
      title: "TX Battle Royale",
      text: "Join me in predicting Bitcoin blocks on TX Battle Royale!",
      url: window.location.href
    });
  } else {
    alert("Sharing not supported");
  }
}

function shareWin() {
  if (navigator.share) {
    navigator.share({
      title: "TX Battle Royale",
      text: `I just won a round with ${gameState.currentUser.guess} tx prediction! 🏆`,
      url: window.location.href
    });
  } else {
    alert("Sharing not supported");
  }
      }
    
