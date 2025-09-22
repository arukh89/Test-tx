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
const connectWalletBtn = document.getElementById("connectWalletBtn");
const disconnectWalletBtn = document.getElementById("disconnectWalletBtn");

// -------------------
// State
// -------------------
let currentBlock = null;
let userFid = null;
let userProfile = null;
let socket;
let isConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;

// -------------------
// Connect to backend (Socket.io) with enhanced error handling
// -------------------
function connectSocket() {
  socket = io(API_URL + "/socket.io/", {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: maxReconnectAttempts
  });

  socket.on("connect", () => {
    console.log("✅ Connected to backend");
    statusElement.textContent = "Connected - Waiting for Bitcoin data...";
    isConnected = true;
    reconnectAttempts = 0;
    
    // Re-join game if user was previously connected
    if (userFid) {
      socket.emit("join", { fid: userFid, profile: userProfile });
    }
  });
  
  socket.on("disconnect", () => {
    console.log("⚠️ Disconnected");
    statusElement.textContent = "Disconnected - Trying to reconnect...";
    isConnected = false;
  });
  
  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    statusElement.textContent = "Connection error - Retrying...";
    reconnectAttempts++;
    
    if (reconnectAttempts >= maxReconnectAttempts) {
      statusElement.textContent = "Connection failed - Please refresh the page";
    }
  });

  socket.on("reconnect", () => {
    console.log("🔄 Reconnected successfully");
    statusElement.textContent = "Reconnected!";
    reconnectAttempts = 0;
  });

  // Block updates with enhanced display
  socket.on("block_update", (block) => {
    currentBlock = block;
    const blockInfo = block ? 
      `Block ${block.height}: ${block.tx_count} TXs | ${new Date(block.timestamp * 1000).toLocaleTimeString()}` : 
      "Waiting for block data...";
    statusElement.textContent = blockInfo;
  });

  // Enhanced players updates with real-time sync
  socket.on("players_update", (players) => {
    renderPlayers(players);
    // Add visual feedback for new players joining
    if (players.length > 0) {
      const latestPlayer = players[players.length - 1];
      console.log(`🎮 Player update: ${latestPlayer.name} joined`);
    }
  });

  // Initial state with better error handling
  socket.on("state", (data) => {
    console.log("📊 Received initial game state:", data);
    if (data.block) {
      currentBlock = data.block;
    }
    if (data.players) {
      renderPlayers(data.players);
    }
    if (data.leaderboard) {
      renderLeaderboard(data.leaderboard);
    }
  });

  // Enhanced chat messages with timestamps
  socket.on("chat_message", (data) => {
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    addChatMessage(data.user, data.message, timestamp, data.type, data.username);
  });

  // Real-time leaderboard updates
  socket.on("leaderboard_update", (leaderboard) => {
    renderLeaderboard(leaderboard);
    console.log("🏆 Leaderboard updated");
  });
}

function renderPlayers(players) {
  playersList.innerHTML = "";
  playerCount.textContent = players.length;
  players.forEach((p) => {
    const li = document.createElement("li");
    const displayName = p.name || p.fid || "Unknown";
    const prediction = p.prediction ? `${p.prediction} TXs` : "No prediction";
    
    // Show Farcaster username if available
    const usernameInfo = p.profile?.username ? ` (@${p.profile.username})` : "";
    
    li.innerHTML = `<span class="player-name">${displayName}${usernameInfo}</span>: <span class="player-prediction">${prediction}</span>`;
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

function addChatMessage(user, message, timestamp, type = "normal", username = null) {
  const div = document.createElement("div");
  
  // Apply different styles based on message type
  switch(type) {
    case "prediction":
      div.classList.add("chat-message", "chat-prediction");
      break;
    case "system":
      div.classList.add("chat-message", "chat-system");
      break;
    default:
      div.classList.add("chat-message", "chat-normal");
  }
  
  const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
  // Format user display with username if available
  const userDisplay = username ? `${user} (@${username})` : user;
  
  // Different formatting based on message type
  if (type === "system") {
    div.innerHTML = `<span class="chat-time">[${timeStr}]</span> <span class="chat-system-text">${message}</span>`;
  } else {
    div.innerHTML = `<span class="chat-time">[${timeStr}]</span> <span class="chat-user">${userDisplay}:</span> ${message}`;
  }
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  
  // Add a subtle animation
  div.style.opacity = '0';
  setTimeout(() => div.style.opacity = '1', 10);
}

// -------------------
// Enhanced Farcaster Wallet Connection
// -------------------
async function connectFarcasterWallet() {
  statusElement.textContent = "Connecting to Farcaster...";
  
  try {
    // Check if Farcaster SDK is available
    if (typeof window.miniApp !== 'undefined' && window.miniApp.actions) {
      console.log("🎭 Farcaster SDK available, attempting connection...");
      
      // Get user profile data
      const user = await window.miniApp.actions.getUser();
      console.log("👤 Farcaster user data:", user);
      
      if (user && user.fid) {
        userFid = user.fid;
        userProfile = {
          fid: user.fid,
          username: user.username || `fid_${user.fid}`,
          displayName: user.displayName || user.username || `User ${user.fid}`,
          pfpUrl: user.pfpUrl || null,
          bio: user.bio || null
        };
        
        updateWalletUI(true);
        console.log("✅ Farcaster wallet connected:", userProfile);
        
        return true;
      } else {
        console.log("❌ No Farcaster user data received");
        throw new Error("No user data from Farcaster");
      }
    } else {
      console.log("🚫 Farcaster SDK not available");
      throw new Error("Farcaster SDK not available");
    }
  } catch (error) {
    console.log("⚠️ Farcaster connection failed, creating anonymous user:", error.message);
    
    // Fallback to anonymous user
    userFid = "anon_" + Math.random().toString(36).substr(2, 9);
    userProfile = {
      fid: userFid,
      username: userFid,
      displayName: `Anonymous ${userFid.slice(-4)}`,
      pfpUrl: null,
      bio: "Anonymous player"
    };
    
    updateWalletUI(false);
    return false;
  }
}

// -------------------
// Wallet UI Management
// -------------------
function updateWalletUI(isConnected) {
  if (isConnected && userProfile) {
    userStatus.textContent = `✅ ${userProfile.displayName} (@${userProfile.username})`;
    connectWalletBtn.classList.add("hidden");
    disconnectWalletBtn.classList.remove("hidden");
    connectWalletBtn.textContent = "Connected!";
  } else {
    userStatus.textContent = userProfile ? `🔴 ${userProfile.displayName} (Anonymous)` : "Not connected";
    connectWalletBtn.classList.remove("hidden");
    disconnectWalletBtn.classList.add("hidden");
    connectWalletBtn.textContent = "Connect Farcaster Wallet";
  }
}

function disconnectWallet() {
  userFid = null;
  userProfile = null;
  updateWalletUI(false);
  
  addChatMessage("System", "Disconnected from Farcaster wallet", new Date(), "system");
  console.log("🔌 Wallet disconnected");
}

// -------------------
// UI Events
// -------------------
// Wallet Connect Button
connectWalletBtn.addEventListener("click", async () => {
  connectWalletBtn.textContent = "Connecting...";
  connectWalletBtn.disabled = true;
  
  const connected = await connectFarcasterWallet();
  if (connected) {
    addChatMessage("System", `${userProfile.displayName} connected their Farcaster wallet!`, new Date(), "system");
  }
  
  connectWalletBtn.disabled = false;
});

// Wallet Disconnect Button
disconnectWalletBtn.addEventListener("click", () => {
  disconnectWallet();
});

// Join Battle Button - simplified since wallet connection is now separate
joinButton.addEventListener("click", async () => {
  if (!userFid) {
    // Prompt user to connect wallet first
    alert("Please connect your Farcaster wallet first!");
    return;
  }
  
  if (isConnected && socket) {
    socket.emit("join", { fid: userFid, profile: userProfile });
    joinButton.textContent = "Joined!";
    joinButton.disabled = true;
    setTimeout(() => {
      joinButton.textContent = "Join Battle";
      joinButton.disabled = false;
    }, 2000);
  } else {
    statusElement.textContent = "Not connected to server. Please wait...";
  }
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
    alert("Please connect your Farcaster wallet first!");
    return;
  }
  
  const prediction = parseInt(predictionInput.value);
  socket.emit("prediction", { fid: userFid, prediction: prediction, profile: userProfile });
  
  // Auto-post to chat when prediction is submitted
  const displayName = userProfile?.displayName || userProfile?.username || userFid;
  const chatMessage = `🎯 ${displayName} predicted ${prediction} transactions for the next block!`;
  socket.emit("chat_message", { fid: userFid, message: chatMessage, profile: userProfile, type: "prediction" });
  
  predictionInput.value = "";
  
  // Visual feedback
  submitPredictionBtn.textContent = "Submitted!";
  submitPredictionBtn.disabled = true;
  setTimeout(() => {
    submitPredictionBtn.textContent = "Submit Prediction";
    submitPredictionBtn.disabled = false;
  }, 1500);
});

sendBtn.addEventListener("click", () => {
  if (!chatInput.value) return;
  if (!userFid) {
    alert("Please connect your Farcaster wallet first!");
    return;
  }
  socket.emit("chat_message", { fid: userFid, message: chatInput.value, profile: userProfile });
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
  // Initialize wallet UI
  updateWalletUI(false);
});
