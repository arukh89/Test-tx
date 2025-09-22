// app.js (Frontend - Netlify)
// Full default logic, connect ke backend Replit

import { actions } from "@farcaster/miniapp-sdk";

// Ganti dengan URL backend Replit kamu
const API_URL = "https://your-backend-name.replit.app";

// -------------------
// DOM Elements
// -------------------
const blockStatus = document.getElementById("block-status");
const joinButton = document.getElementById("join-btn");
const shareButton = document.getElementById("share-btn");
const prevBlockButton = document.getElementById("prev-block-btn");
const presentBlockButton = document.getElementById("present-block-btn");
const predictionForm = document.getElementById("prediction-form");
const predictionInput = document.getElementById("prediction");
const playersList = document.getElementById("players-list");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const leaderboardList = document.getElementById("leaderboard-list");

// -------------------
// State
// -------------------
let currentBlock = null;
let userFid = null;
let socket;

// -------------------
// Connect ke backend Replit (Socket.io)
// -------------------
function connectSocket() {
  socket = io(API_URL);

  socket.on("connect", () => console.log("✅ Connected to backend"));
  socket.on("disconnect", () => console.log("⚠️ Disconnected"));

  // Block updates
  socket.on("block_update", (block) => {
    currentBlock = block;
    blockStatus.textContent = `Live block: ${block.height} | ${block.tx_count} TXs`;
  });

  // Players updates
  socket.on("players_update", (players) => {
    renderPlayers(players);
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
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${p.prediction}`;
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
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -------------------
// UI Events
// -------------------
joinButton.addEventListener("click", async () => {
  if (!userFid) {
    const user = await actions.getUser();
    if (user && user.fid) {
      userFid = user.fid;
    } else {
      alert("Please connect your Farcaster wallet!");
      return;
    }
  }
  socket.emit("join", { fid: userFid });
});

shareButton.addEventListener("click", () => {
  actions.openUrl("https://testtx.netlify.app");
});

prevBlockButton.addEventListener("click", () => {
  socket.emit("get_previous_block");
});

presentBlockButton.addEventListener("click", () => {
  socket.emit("get_present_block");
});

predictionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!predictionInput.value) return;
  socket.emit("prediction", { fid: userFid, prediction: predictionInput.value });
  predictionInput.value = "";
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!chatInput.value) return;
  socket.emit("chat_message", { fid: userFid, message: chatInput.value });
  chatInput.value = "";
});

// -------------------
// Init
// -------------------
connectSocket();

// ✅ Wajib: kasih sinyal ke Farcaster kalau app sudah siap
window.addEventListener("load", () => {
  actions.ready();
});
