// app.js (Frontend - Netlify)
// Full default logic, connect ke backend Replit

/*
  NOTE: Browser environments can't resolve bare-package imports like
  `import { actions } from "@farcaster/miniapp-sdk";` unless you bundle the code.
  The original project included the UMD bundle via a script tag:
    <script src="https://unpkg.com/@farcaster/miniapp-sdk/dist/index.umd.js"></script>
  That UMD bundle exposes the SDK on a global object. Below we attempt to
  find the `actions` object on a few likely global names. This preserves the
  rest of your app logic while fixing the "stuck on splash" issue caused by
  a syntax/import error in the browser.
*/

let actions = null;
if (typeof window !== "undefined") {
  if (window.Farcaster && window.Farcaster.actions) actions = window.Farcaster.actions;
  else if (window.FarcasterMiniAppSDK && window.FarcasterMiniAppSDK.actions) actions = window.FarcasterMiniAppSDK.actions;
  else if (window.farcasterMiniAppSdk && window.farcasterMiniAppSdk.actions) actions = window.farcasterMiniAppSdk.actions;
  else if (window.__farcaster_miniapp_sdk__ && window.__farcaster_miniapp_sdk__.actions) actions = window.__farcaster_miniapp_sdk__.actions;
  else if (window.farcaster && window.farcaster.actions) actions = window.farcaster.actions;
  else if (window.actions) actions = window.actions;
}

if (!actions) {
  console.warn(
    "Farcaster miniapp SDK `actions` not found on window. Falling back to a noop stub. If splash persists, ensure the UMD SDK script is loaded before app.js."
  );
  actions = {
    ready() {
      console.warn("actions.ready() called on noop stub");
    },
  };
}

// Ganti dengan URL backend Replit kamu
const API_URL = "https://1a4f1f38-1bc5-459f-89d3-7e411642339d-00-8cgu1jweczd6.sisko.replit.dev";

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

// -------------------
// Render functions
// -------------------
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
  div.innerHTML = `<strong>${user}:</strong> ${message}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -------------------
// Event Listeners
// -------------------
joinButton.addEventListener("click", () => {
  if (socket) socket.emit("join_game", { name: `User${Math.floor(Math.random() * 1000)}` });
});

shareButton.addEventListener("click", () => {
  if (actions.share) {
    actions.share({ text: "Join me in TX Battle Royale!" });
  } else {
    alert("Share not supported here.");
  }
});

predictionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const prediction = parseInt(predictionInput.value, 10);
  if (!isNaN(prediction) && socket) {
    socket.emit("submit_prediction", { prediction });
    predictionInput.value = "";
  }
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (msg && socket) {
    socket.emit("chat_message", { message: msg });
    chatInput.value = "";
  }
});

prevBlockButton.addEventListener("click", () => {
  if (socket) socket.emit("request_prev_block");
});

presentBlockButton.addEventListener("click", () => {
  if (socket) socket.emit("request_present_block");
});

// -------------------
// Init
// -------------------
window.addEventListener("load", () => {
  connectSocket();
  // ✅ panggil ready agar splash hilang
  actions.ready();
});
