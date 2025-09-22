const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3001;

// Data in-memory
let currentBlock = null;
let players = [];
let leaderboard = [];
let blocks = [];

// Fetch latest blocks
async function fetchLatestBlocks() {
  try {
    const res = await fetch("https://mempool.space/api/blocks");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      blocks = data;
      currentBlock = data[0];
      io.emit("block_update", currentBlock);
    }
  } catch (err) {
    console.error("Error fetching blocks", err);
  }
}

// Update leaderboard (simple scoring)
function updateLeaderboard() {
  leaderboard = players.map((p) => ({
    name: p.name,
    score: Math.floor(Math.random() * 100), // random for demo
  }));
  io.emit("leaderboard_update", leaderboard);
}

// Run fetch every 30s
setInterval(fetchLatestBlocks, 30000);
fetchLatestBlocks();

// Socket.io logic
io.on("connection", (socket) => {
  console.log("New client connected");

  // --- Core handlers ---
  socket.on("join", (data) => {
    console.log("join", data);
    const profile = data?.profile || {};
    const displayName = profile.displayName || profile.username || data?.fid || "anon";
    
    // Check if player already exists, update if so, otherwise add new player
    const existingPlayerIndex = players.findIndex(p => p.fid === data?.fid);
    if (existingPlayerIndex >= 0) {
      players[existingPlayerIndex] = { 
        fid: data?.fid || "anon", 
        name: displayName,
        prediction: players[existingPlayerIndex].prediction,
        profile: profile
      };
    } else {
      players.push({ 
        fid: data?.fid || "anon", 
        name: displayName, 
        prediction: null,
        profile: profile
      });
    }
    
    io.emit("players_update", players);
    socket.emit("state", { block: currentBlock, players, leaderboard });
    
    // Welcome message to chat
    const welcomeMessage = `🎮 ${displayName} joined the battle!`;
    io.emit("chat_message", { 
      user: displayName, 
      message: welcomeMessage, 
      type: "system",
      timestamp: new Date().toISOString()
    });
  });

  socket.on("prediction", (data) => {
    console.log("prediction", data);
    if (!data?.fid) return;
    const player = players.find((p) => p.fid === data.fid);
    if (player) {
      player.prediction = data.prediction;
      // Update profile if provided
      if (data.profile) {
        player.profile = data.profile;
        player.name = data.profile.displayName || data.profile.username || data.fid;
      }
    }
    io.emit("players_update", players);
    updateLeaderboard();
  });

  socket.on("chat_message", (data) => {
    console.log("chat_message", data);
    const profile = data?.profile || {};
    const displayName = profile.displayName || profile.username || data?.fid || "anon";
    const username = profile.username || null;
    
    io.emit("chat_message", { 
      user: displayName,
      username: username,
      message: data.message,
      type: data.type || "normal",
      timestamp: new Date().toISOString(),
      fid: data?.fid,
      profile: profile
    });
  });

  socket.on("get_previous_block", () => {
    if (blocks.length > 1) {
      socket.emit("block_update", blocks[1]);
    }
  });

  socket.on("get_present_block", () => {
    if (blocks.length > 0) {
      socket.emit("block_update", blocks[0]);
    }
  });

  // --- ✅ Compatibility aliases (tambahan, tidak mengubah HTML/CSS) ---
  socket.on("join_game", (data) => {
    console.log("alias join_game", data);
    players.push({ name: data?.fid || "anon", prediction: null });
    io.emit("players_update", players);
    socket.emit("state", { block: currentBlock, players, leaderboard });
  });

  socket.on("submit_prediction", (data) => {
    console.log("alias submit_prediction", data);
    if (!data?.fid) return;
    const player = players.find((p) => p.name === data.fid);
    if (player) {
      player.prediction = data.prediction;
    }
    io.emit("players_update", players);
    updateLeaderboard();
  });

  socket.on("request_prev_block", () => {
    console.log("alias request_prev_block");
    if (blocks.length > 1) {
      socket.emit("block_update", blocks[1]);
    }
  });

  socket.on("request_present_block", () => {
    console.log("alias request_present_block");
    if (blocks.length > 0) {
      socket.emit("block_update", blocks[0]);
    }
  });
});

// Routes
app.get("/", (req, res) => {
  res.send("TX Battle Royale backend is running");
});

// Start server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
