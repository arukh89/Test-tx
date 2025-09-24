// ================================
// BACKEND: TX Battle Royale
// ================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// -------------------------
// STATE
// -------------------------
let players = []; // { fid, username, display_name, pfp_url, score }
let leaderboard = []; // { username, score }

// -------------------------
// EXPRESS ENDPOINTS
// -------------------------
app.get("/", (req, res) => {
  res.send("TX Battle Royale backend is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", players: players.length });
});

// -------------------------
// SOCKET.IO HANDLERS
// -------------------------
io.on("connection", (socket) => {
  console.log("🔌 New client connected");

  // Join game (ambil data user dari Neynar)
  socket.on("join", async ({ fid }) => {
    console.log(`Join request FID=${fid}`);

    try {
      const resp = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        { headers: { api_key: NEYNAR_API_KEY } }
      );
      const data = await resp.json();

      if (data.users && data.users.length > 0) {
        const user = data.users[0];

        const userObj = {
          fid: user.fid,
          username: user.username,
          display_name: user.display_name,
          pfp_url: user.pfp_url,
          score: 0
        };

        // cek apakah sudah ada
        const exists = players.find((p) => p.fid === user.fid);
        if (!exists) {
          players.push(userObj);
        }

        // emit balik ke user ini
        socket.emit("user_data", userObj);

        // broadcast players ke semua
        io.emit("players", players);

        // update leaderboard
        updateLeaderboard();
      }
    } catch (err) {
      console.error("❌ Error fetching Neynar user:", err);
    }
  });

  // Chat message
  socket.on("chat_message", (msg) => {
    io.emit("chat_message", msg);
  });

  // Prediction
  socket.on("prediction", ({ value }) => {
    console.log("Prediction received:", value);
    // Demo: tambahin skor random
    const user = players[Math.floor(Math.random() * players.length)];
    if (user) {
      user.score += Math.floor(Math.random() * 10);
      updateLeaderboard();
    }
  });

  // Block controls
  socket.on("prev_block", () => {
    io.emit("chat_message", "⬅️ Moved to previous block");
  });

  socket.on("curr_block", () => {
    io.emit("chat_message", "🔄 Back to current block");
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
    // NOTE: bisa tambahkan logic remove player kalau mau
  });
});

// -------------------------
// LEADERBOARD UPDATE
// -------------------------
function updateLeaderboard() {
  leaderboard = players
    .map((p) => ({ username: p.username, score: p.score }))
    .sort((a, b) => b.score - a.score);

  io.emit("leaderboard", leaderboard);
}

// -------------------------
// START SERVER
// -------------------------
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});