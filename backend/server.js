// server.js (Backend Hybrid - Replit)
// Support "state" (versi lama) + granular events (versi baru)

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// -------------------
// State
// -------------------
let players = [];
let leaderboard = [];
let currentBlock = null;
let previousBlock = null;

// -------------------
// Fetch Bitcoin Block (mempool.space API)
// -------------------
async function fetchBlocks() {
  try {
    const res = await fetch("https://mempool.space/api/blocks");
    const data = await res.json();
    if (data && data.length > 0) {
      currentBlock = {
        height: data[0].height,
        tx_count: data[0].tx_count
      };
      if (data.length > 1) {
        previousBlock = {
          height: data[1].height,
          tx_count: data[1].tx_count
        };
      }

      // 🔹 Emit granular event
      io.emit("block_update", currentBlock);

      // 🔹 Emit state event (lama)
      io.emit("state", {
        block: currentBlock,
        previousBlock,
        players,
        leaderboard
      });
    }
  } catch (err) {
    console.error("Error fetch blocks:", err);
  }
}

// update tiap 30 detik
setInterval(fetchBlocks, 30000);
fetchBlocks();

// -------------------
// Socket.io Logic
// -------------------
io.on("connection", (socket) => {
  console.log("✅ Client connected");

  // join
  socket.on("join", ({ fid, name }) => {
    if (!players.find((p) => p.fid === fid)) {
      players.push({ fid, name: name || `User-${fid}`, prediction: null, score: 0 });
    }

    // granular
    io.emit("players_update", players);
    // state
    io.emit("state", { block: currentBlock, previousBlock, players, leaderboard });
  });

  // prediction
  socket.on("prediction", ({ fid, prediction }) => {
    players = players.map((p) =>
      p.fid === fid ? { ...p, prediction } : p
    );
    io.emit("players_update", players);
    io.emit("state", { block: currentBlock, previousBlock, players, leaderboard });
  });

  // chat
  socket.on("chat_message", ({ fid, message }) => {
    const player = players.find((p) => p.fid === fid);
    const name = player ? player.name : `User-${fid}`;
    io.emit("chat_message", { user: name, message });
  });

  // update score (leaderboard)
  socket.on("update_score", ({ fid, points }) => {
    players = players.map((p) =>
      p.fid === fid ? { ...p, score: p.score + points } : p
    );
    leaderboard = [...players].sort((a, b) => b.score - a.score);

    io.emit("leaderboard_update", leaderboard);
    io.emit("state", { block: currentBlock, previousBlock, players, leaderboard });
  });

  // previous block
  socket.on("get_previous_block", () => {
    if (previousBlock) {
      socket.emit("block_update", previousBlock);
    }
  });

  // present block
  socket.on("get_present_block", () => {
    if (currentBlock) {
      socket.emit("block_update", currentBlock);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});

// -------------------
// Start server
// -------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
