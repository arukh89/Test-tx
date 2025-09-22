// app.js (Frontend)
// Full default logic, connect to backend

// Use local backend URL - Replit will proxy appropriately
const API_URL = window.location.origin;

// -------------------
// DOM Elements - Updated to match index.html IDs
// -------------------
const statusElement = document.getElementById("status");
const joinButton = document.getElementById("joinBtn");
const shareButton = document.getElementById("shareBtn");
const prevBlockButton = document.getElementById("prevBlockBtn");
const presentBlockButton = document.getElementById("currBlockBtn");
const predictionInput = document.getElementById("predictionInput");
const submitPredictionBtn = document.getElementById("submitPrediction");
const playerCount = document.getElementById("playerCount");
const playersList = document.getElementById("playerList");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatBox");
const leaderboardList = document.getElementById("leaderboardList");
const userStatus = document.getElementById("userStatus");

// -------------------
// State
// -------------------
let currentBlock = null;
let userFid = null;
let socket;

// -------------------
// Connect to backend (Socket.io)
// -------------------
function connectSocket() {
  socket = io(API_URL + "/socket.io/");

  socket.on("connect", () => {
    console.log("✅ Connected to backend");
    statusElement.textContent = "Connected";
  });
  
  socket.on("disconnect", () => {
    console.log("⚠️ Disconnected");
    statusElement.textContent = "Disconnected";
  });

  // Block updates
  socket.on("block_update", (block) => {
    currentBlock = block;
    statusElement.textContent = `Live block: ${block.height} | ${block.tx_count} TXs`;
  });

  // Players updates
  socket.on("players_update", (players) => {
    renderPlayers(players);
  });

  // Initial state
  socket.on("state", (data) => {
    currentBlock = data.block;
    renderPlayers(data.players);
    renderLeaderboard(data.leaderboard);
  });

  // Chat messages
  socket.on("chat_message", (data) => {
    addChatMessage(data.user, data.message);
  });

  // Leaderboard updates
  socket.on("leaderboard_update", (leaderboard) => {
    renderLeaderboard(leaderboard);
  });
}

function renderPlayers(players) {
  playersList.innerHTML = "";
  playerCount.textContent = players.length;
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${p.prediction || "No prediction"}`;
    playersList.appendChild(li);
  });
}

function renderLeaderboard(leaderboard) {
  leaderboardList.innerHTML = "";
  leaderboard.forEach((entry, index) => {
    const li = document.createElement("li");
    if (index === 0) li.classList.add("gold");
    else if (index === 1) li.classList.add("silver");
    else if (index === 2) li.classList.add("bronze");
    li.textContent = `${entry.name} — ${entry.score} pts`;
    leaderboardList.appendChild(li);
  });
}

function addChatMessage(user, message) {
  const div = document.createElement("div");
  div.classList.add("chat-message");
  div.textContent = `${user}: ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// -------------------
// UI Events
// -------------------
joinButton.addEventListener("click", async () => {
  if (!userFid) {
    // Try to get Farcaster user info
    try {
      if (typeof window.miniApp !== 'undefined' && window.miniApp.actions) {
        const user = await window.miniApp.actions.getUser();
        if (user && user.fid) {
          userFid = user.fid;
          userStatus.textContent = `Signed in as FID: ${userFid}`;
        }
      }
    } catch (error) {
      console.log("Farcaster SDK not available, using anonymous user");
    }
    
    if (!userFid) {
      userFid = "anon_" + Math.random().toString(36).substr(2, 9);
      userStatus.textContent = `Signed in as ${userFid}`;
    }
  }
  socket.emit("join", { fid: userFid });
});

shareButton.addEventListener("click", () => {
  if (typeof window.miniApp !== 'undefined' && window.miniApp.actions) {
    window.miniApp.actions.openUrl(window.location.href);
  } else {
    // Fallback for non-Farcaster environments
    navigator.share?.({ 
      title: 'TX Battle Royale', 
      url: window.location.href 
    }) || alert('Share: ' + window.location.href);
  }
});

prevBlockButton.addEventListener("click", () => {
  socket.emit("get_previous_block");
});

presentBlockButton.addEventListener("click", () => {
  socket.emit("get_present_block");
});

submitPredictionBtn.addEventListener("click", () => {
  if (!predictionInput.value) return;
  if (!userFid) {
    alert("Please join the battle first!");
    return;
  }
  socket.emit("prediction", { fid: userFid, prediction: parseInt(predictionInput.value) });
  predictionInput.value = "";
});

sendBtn.addEventListener("click", () => {
  if (!chatInput.value) return;
  if (!userFid) {
    alert("Please join the battle first!");
    return;
  }
  socket.emit("chat_message", { fid: userFid, message: chatInput.value });
  chatInput.value = "";
});

// Allow Enter key for chat
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

// Allow Enter key for prediction
predictionInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    submitPredictionBtn.click();
  }
});

// -------------------
// Init
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  connectSocket();
  
  // Initialize Farcaster SDK if available
  if (typeof window.miniApp !== 'undefined' && window.miniApp.actions) {
    window.miniApp.actions.ready();
  }
});
