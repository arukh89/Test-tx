// app.js
import { actions } from "@farcaster/miniapp-sdk";

const API_URL = "https://YOUR-BACKEND-URL"; // ganti dengan URL backend kamu

// DOM elements
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

// state
let currentBlock = null;
let userFid = null;
let ws;

// connect websocket
function connectWebSocket() {
  ws = new WebSocket(`${API_URL.replace("http", "ws")}/ws`);

  ws.onopen = () => console.log("✅ WebSocket connected");
  ws.onclose = () => {
    console.log("⚠️ WebSocket closed, retrying...");
    setTimeout(connectWebSocket, 3000);
  };
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    handleWSMessage(data);
  };
}

function handleWSMessage(data) {
  if (data.type === "block_update") {
    currentBlock = data.block;
    blockStatus.textContent = `Live block: ${data.block.height} | ${data.block.tx_count} TXs`;
  }

  if (data.type === "players_update") {
    renderPlayers(data.players);
  }

  if (data.type === "chat_message") {
    addChatMessage(data.user, data.message);
  }

  if (data.type === "leaderboard_update") {
    renderLeaderboard(data.leaderboard);
  }
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

// events
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
  ws.send(JSON.stringify({ type: "join", fid: userFid }));
});

shareButton.addEventListener("click", () => {
  actions.openUrl("https://testtx.netlify.app");
});

prevBlockButton.addEventListener("click", () => {
  ws.send(JSON.stringify({ type: "get_previous_block" }));
});

presentBlockButton.addEventListener("click", () => {
  ws.send(JSON.stringify({ type: "get_present_block" }));
});

predictionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!predictionInput.value) return;
  ws.send(
    JSON.stringify({
      type: "prediction",
      fid: userFid,
      prediction: predictionInput.value,
    })
  );
  predictionInput.value = "";
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!chatInput.value) return;
  ws.send(
    JSON.stringify({
      type: "chat_message",
      fid: userFid,
      message: chatInput.value,
    })
  );
  chatInput.value = "";
});

// init
connectWebSocket();

// 🔥 penting: kasih sinyal ke Farcaster kalau app sudah siap
window.addEventListener("load", () => {
  actions.ready();
});
          
