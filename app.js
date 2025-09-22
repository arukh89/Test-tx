import { sdk } from "@farcaster/miniapp-sdk";

// ✅ Panggil ready() biar splash screen hilang
sdk.actions.ready();

let socket;
const statusEl = document.getElementById("status");
const playerList = document.getElementById("playerList");
const playerCount = document.getElementById("playerCount");
const chatBox = document.getElementById("chatBox");
const leaderboardList = document.getElementById("leaderboardList");
const userStatus = document.getElementById("userStatus");

// Connect ke backend Replit kamu
function connectSocket() {
  socket = new WebSocket("wss://YOUR_REPLIT_URL_HERE");

  socket.onopen = () => {
    statusEl.textContent = "Connected to live Bitcoin blocks!";
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "block") {
      statusEl.textContent = `Live block: ${data.height} | ${data.txCount} TXs`;
    }

    if (data.type === "players") {
      playerCount.textContent = data.players.length;
      playerList.innerHTML = "";
      data.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        playerList.appendChild(li);
      });
    }

    if (data.type === "chat") {
      appendChatMessage(data.username, data.message, data.chatType || "chat-normal");
    }

    if (data.type === "leaderboard") {
      leaderboardList.innerHTML = "";
      data.leaderboard.forEach((entry, i) => {
        const li = document.createElement("li");
        if (i === 0) li.classList.add("gold");
        if (i === 1) li.classList.add("silver");
        if (i === 2) li.classList.add("bronze");
        li.innerHTML = `<span>${entry.user}</span><span>${entry.score}</span>`;
        leaderboardList.appendChild(li);
      });
    }
  };

  socket.onclose = () => {
    statusEl.textContent = "Disconnected. Reconnecting...";
    setTimeout(connectSocket, 3000);
  };
}
connectSocket();

function appendChatMessage(user, message, type) {
  const div = document.createElement("div");
  div.classList.add(type);
  div.innerHTML = `<strong>${user}:</strong> ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById("joinBtn").onclick = () => {
  socket.send(JSON.stringify({ type: "join" }));
};

document.getElementById("submitPrediction").onclick = () => {
  const guess = document.getElementById("predictionInput").value;
  if (guess) {
    socket.send(JSON.stringify({ type: "prediction", value: guess }));
    appendChatMessage("You", `Predicted ${guess} TXs`, "chat-prediction");
    document.getElementById("predictionInput").value = "";
  }
};

document.getElementById("sendBtn").onclick = () => {
  const msg = document.getElementById("chatInput").value;
  if (msg) {
    socket.send(JSON.stringify({ type: "chat", message: msg }));
    appendChatMessage("You", msg, "chat-normal");
    document.getElementById("chatInput").value = "";
  }
};

document.getElementById("prevBlockBtn").onclick = () => {
  socket.send(JSON.stringify({ type: "getPrevBlock" }));
};

document.getElementById("currBlockBtn").onclick = () => {
  socket.send(JSON.stringify({ type: "getCurrBlock" }));
};

document.getElementById("shareBtn").onclick = () => {
  sdk.actions.openUrl("https://warpcast.com/~/compose?text=Join%20TX%20Battle%20Royale!");
};

sdk.actions.getUser().then(user => {
  if (user && user.username) {
    userStatus.textContent = `Signed in as ${user.username}`;
  }
}).catch(() => {
  userStatus.textContent = "Signed in as Not signed";
});