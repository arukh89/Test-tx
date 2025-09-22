const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");
const { initializeDatabase, PlayerDatabase } = require("./database");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3001;
const playerDB = new PlayerDatabase();

// Data in-memory (for real-time game state)
let currentBlock = null;
let activePlayers = []; // Active players in current session
let blocks = [];
let leaderboardData = [];

// Fetch latest blocks and check for new blocks
async function fetchLatestBlocks() {
  try {
    const res = await fetch("https://mempool.space/api/blocks");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const newBlock = data[0];
      
      // Check if we have a new block
      if (!currentBlock || newBlock.height > currentBlock.height) {
        const previousBlock = currentBlock;
        
        // Process predictions for the previous block if it exists
        if (previousBlock) {
          await processPredictions(previousBlock);
        }
        
        currentBlock = newBlock;
        blocks = data;
        io.emit("block_update", currentBlock);
        
        // Update leaderboard after processing predictions
        await updateLeaderboard();
      }
    }
  } catch (err) {
    console.error("Error fetching blocks", err);
  }
}

// Process predictions when a new block is found
async function processPredictions(block) {
  console.log(`Processing predictions for block ${block.height} with ${block.tx_count} transactions`);
  
  for (const player of activePlayers) {
    if (player.prediction !== null && player.fid !== "anon") {
      try {
        const result = await playerDB.updatePredictionResult(
          player.fid, 
          block.height, 
          block.tx_count
        );
        
        if (result) {
          console.log(`Player ${player.name} scored ${result.points} points (predicted ${player.prediction}, actual ${result.actualTransactions})`);
          
          // Notify player of their score
          io.emit("prediction_result", {
            fid: player.fid,
            blockHeight: block.height,
            prediction: player.prediction,
            actual: result.actualTransactions,
            points: result.points,
            difference: result.difference
          });
        }
      } catch (error) {
        console.error(`Error processing prediction for player ${player.fid}:`, error);
      }
    }
  }
  
  // Clear predictions for next round
  activePlayers.forEach(player => player.prediction = null);
  io.emit("players_update", activePlayers);
}

// Update leaderboard with real database data
async function updateLeaderboard() {
  try {
    leaderboardData = await playerDB.getLeaderboard(10);
    io.emit("leaderboard_update", leaderboardData);
    console.log(`📊 Leaderboard updated with ${leaderboardData.length} players`);
  } catch (error) {
    console.error("Error updating leaderboard:", error);
  }
}

// Run fetch every 30s
setInterval(fetchLatestBlocks, 30000);
fetchLatestBlocks();

// Initialize database on startup
async function initializeServer() {
  try {
    await initializeDatabase();
    console.log("🎮 TX Battle Royale backend initialized with database");
    
    // Load initial leaderboard
    await updateLeaderboard();
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

// Socket.io logic
io.on("connection", (socket) => {
  console.log("New client connected");

  // --- Core handlers ---
  socket.on("join", async (data) => {
    console.log("join", data);
    const profile = data?.profile || {};
    const displayName = profile.displayName || profile.username || data?.fid || "anon";
    const fid = data?.fid || "anon";
    
    try {
      // Save/update player in database if not anonymous
      if (fid !== "anon") {
        await playerDB.createOrUpdatePlayer({
          fid: fid,
          username: profile.username,
          displayName: displayName,
          pfpUrl: profile.pfpUrl,
          bio: profile.bio
        });
      }
    } catch (error) {
      console.error("Error saving player to database:", error);
    }
    
    // Check if player already exists in active session
    const existingPlayerIndex = activePlayers.findIndex(p => p.fid === fid);
    if (existingPlayerIndex >= 0) {
      activePlayers[existingPlayerIndex] = { 
        fid: fid, 
        name: displayName,
        prediction: activePlayers[existingPlayerIndex].prediction,
        profile: profile
      };
    } else {
      activePlayers.push({ 
        fid: fid, 
        name: displayName, 
        prediction: null,
        profile: profile
      });
    }
    
    io.emit("players_update", activePlayers);
    socket.emit("state", { 
      block: currentBlock, 
      players: activePlayers, 
      leaderboard: leaderboardData 
    });
    
    // Welcome message to chat
    const welcomeMessage = `🎮 ${displayName} joined the battle!`;
    io.emit("chat_message", { 
      user: displayName, 
      message: welcomeMessage, 
      type: "system",
      timestamp: new Date().toISOString()
    });
  });

  socket.on("prediction", async (data) => {
    console.log("prediction", data);
    if (!data?.fid) return;
    
    // Update active player's prediction
    const player = activePlayers.find((p) => p.fid === data.fid);
    if (player) {
      player.prediction = data.prediction;
      // Update profile if provided
      if (data.profile) {
        player.profile = data.profile;
        player.name = data.profile.displayName || data.profile.username || data.fid;
      }
      
      // Record prediction in database if not anonymous
      if (data.fid !== "anon" && currentBlock) {
        try {
          await playerDB.recordPrediction(data.fid, currentBlock.height, data.prediction);
          console.log(`Recorded prediction: ${player.name} predicted ${data.prediction} for block ${currentBlock.height}`);
        } catch (error) {
          console.error("Error recording prediction:", error);
        }
      }
    }
    
    io.emit("players_update", activePlayers);
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

  // --- ✅ Compatibility aliases ---
  socket.on("join_game", async (data) => {
    console.log("alias join_game", data);
    const fid = data?.fid || "anon";
    const displayName = fid;
    
    activePlayers.push({ fid: fid, name: displayName, prediction: null });
    io.emit("players_update", activePlayers);
    socket.emit("state", { 
      block: currentBlock, 
      players: activePlayers, 
      leaderboard: leaderboardData 
    });
  });

  socket.on("submit_prediction", async (data) => {
    console.log("alias submit_prediction", data);
    if (!data?.fid) return;
    
    const player = activePlayers.find((p) => p.fid === data.fid);
    if (player) {
      player.prediction = data.prediction;
      
      // Record in database if not anonymous
      if (data.fid !== "anon" && currentBlock) {
        try {
          await playerDB.recordPrediction(data.fid, currentBlock.height, data.prediction);
        } catch (error) {
          console.error("Error recording prediction:", error);
        }
      }
    }
    io.emit("players_update", activePlayers);
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

// Start server with database initialization
async function startServer() {
  await initializeServer();
  
  server.listen(PORT, () => {
    console.log(`🚀 TX Battle Royale Server listening on port ${PORT}`);
    console.log(`📊 Real-time leaderboard and player data persistence enabled`);
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
