import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fetch from "node-fetch";
import path from "path";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Serve static files including .well-known directory
app.use(express.static('.', { dotfiles: 'allow' }));

// ----------------------
// ROUTE TEST NEYNAR
// ----------------------
app.get("/user/:fid", async (req, res) => {
  try {
    const fid = req.params.fid;
    const resp = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      { headers: { api_key: process.env.NEYNAR_API_KEY } },
    );
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Neynar API error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ----------------------
// SOCKET.IO HANDLING
// ----------------------
let players = [];

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // ---- join game ----
  socket.on("join", async ({ fid }) => {
    try {
      const resp = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        { headers: { api_key: process.env.NEYNAR_API_KEY } },
      );
      const data = await resp.json();
      const user = data.users?.[0];

      if (user) {
        const player = {
          fid,
          username: user.username,
          display_name: user.display_name,
          pfp_url: user.pfp_url,
        };

        players.push(player);

        // kirim balik ke user yang join
        socket.emit("user_data", player);

        // broadcast semua player ke semua client
        io.emit("players", players);

        console.log("🎮 Player joined:", user.username);
      }
    } catch (err) {
      console.error("❌ Error join:", err);
    }
  });

  // ---- chat ----
  socket.on("chat_message", (msg) => {
    io.emit("chat_message", msg);
  });

  // ---- disconnect ----
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ----------------------
// ROOT ROUTE
// ----------------------
app.get("/", (req, res) => {
  res.send("🚀 Backend running (Neynar connected, no DB)");
});

// ----------------------
// RUN SERVER
// ----------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
