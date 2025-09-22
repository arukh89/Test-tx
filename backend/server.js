const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch

const app = express();
app.use(cors());
app.get("/", (req, res) => {
  res.send("TX Battle Royale Backend is running ✅ (mempool.space connected)");
});

// buat server HTTP
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// ---- Game State ----
let players = [];
let leaderboard = [];
let currentBlock = { height: 0, tx_count: 0 };
let previousBlock = { height: 0, tx_count: 0 };

// ---- Socket Events ----
io.on("connection", (socket) => {
  console.log("🔥 Client connected:", socket.id);

  // kirim state awal
  socket.emit("state", { players, leaderboard, currentBlock });

  // join battle
  socket.on("join", (data) => {
    const newPlayer = { id: socket.id, display: data.display, guess: null };
    players.push(newPlayer);
    io.emit("state", { players, leaderboard, currentBlock });
    io.emit("chat", `👋 ${data.display} joined the battle`);
  });

  // receive prediction
  socket.on("prediction", (data) => {
    players = players.map(p =>
      p.id === socket.id ? { ...p, guess: data.guess } : p
    );
    io.emit("state", { players, leaderboard, currentBlock });
  });

  // chat
  socket.on("chat", (msg) => {
    io.emit("chat", msg);
  });

  // disconnect
  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit("state", { players, leaderboard, currentBlock });
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ---- Ambil block asli dari mempool.space ----
async function updateBlock() {
  try {
    const blocks = await fetch("https://mempool.space/api/blocks").then(r => r.json());
    if (blocks && blocks.length > 1) {
      const latest = blocks[0];
      const prev = blocks[1];

      previousBlock = {
        height: prev.height,
        tx_count: prev.tx_count || 0
      };
      currentBlock = {
        height: latest.height,
        tx_count: latest.tx_count || 0
      };

      io.emit("state", { players, leaderboard, currentBlock });
      console.log(`📦 Block updated: #${currentBlock.height} (${currentBlock.tx_count} txs)`);
    }
  } catch (err) {
    console.error("❌ Error fetching mempool.space data:", err);
  }
}

// update setiap 30 detik
setInterval(updateBlock, 30000);
updateBlock(); // jalan pertama kali

// ---- Start Server ----
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
