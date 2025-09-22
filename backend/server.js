const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.get("/", (req, res) => {
  res.send("TX Battle Royale Backend is running ✅");
});

// buat server HTTP
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

// ---- Game State ----
let players = [];
let leaderboard = [];
let currentBlock = { height: 12345, tx_count: 2500 };

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
    players = players.map(p => p.id === socket.id ? { ...p, guess: data.guess } : p);
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

// ---- Simulasi Block Baru tiap 60 detik ----
setInterval(() => {
  currentBlock = {
    height: currentBlock.height + 1,
    tx_count: Math.floor(Math.random() * 3000) + 1000
  };

  // tentukan pemenang (yang paling dekat prediksinya)
  if (players.length > 0) {
    let winner = null;
    let bestDiff = Infinity;
    players.forEach(p => {
      if (p.guess !== null) {
        const diff = Math.abs(p.guess - currentBlock.tx_count);
        if (diff < bestDiff) {
          bestDiff = diff;
          winner = p;
        }
      }
    });
    if (winner) {
      leaderboard = leaderboard.map(l => {
        if (l.name === winner.display) return { ...l, wins: l.wins + 1 };
        return l;
      });
      if (!leaderboard.find(l => l.name === winner.display)) {
        leaderboard.push({ name: winner.display, wins: 1 });
      }
      io.emit("settlement", { height: currentBlock.height, tx_count: currentBlock.tx_count, winner: winner.display });
    }
  }

  io.emit("state", { players, leaderboard, currentBlock });
}, 60000); // 60 detik

// ---- Start Server ----
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
