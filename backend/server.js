// backend/server.js
// Socket.IO backend that subscribes to mempool/block WS and broadcasts state
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

let fetch;
try {
  fetch = global.fetch || require('node-fetch');
} catch (e) {
  fetch = null;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3001;
const MEMPOOL_WS_URL = process.env.MEMPOOL_WS_URL || 'wss://ws.blockchain.info/inv';
const BLOCK_POLL_URL = process.env.BLOCK_POLL_URL || 'https://blockstream.info/api/blocks/tip/height';
const BLOCK_POLL_INTERVAL_MS = Number(process.env.BLOCK_POLL_INTERVAL_MS || 20000);

let players = [];
let leaderboard = [];
let currentBlock = null;
let recentTxs = [];
const RECENT_TX_LIMIT = 100;

function recomputeLeaderboard() {
  leaderboard = players.map(p => ({ fid: p.fid, name: p.profile?.name || p.name || p.fid, score: Number(p.score || 0) }))
                       .sort((a,b) => b.score - a.score).slice(0, 50);
}

app.get('/', (req, res) => res.send('TX Battle Royale backend is running'));
app.get('/state', (req, res) => { recomputeLeaderboard(); res.json({ currentBlock, players, leaderboard, recentTxsCount: recentTxs.length }); });

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  recomputeLeaderboard();
  socket.emit('state', { block: currentBlock, players, leaderboard });

  socket.on('join', (payload) => {
    try {
      const { fid, profile } = payload || {};
      if (!fid) { socket.emit('error', { message: 'join requires fid' }); return; }
      let p = players.find(x => x.fid === fid);
      if (!p) {
        p = { fid, profile: profile || {}, name: profile?.name || `guest-${fid.slice(-6)}`, score: 0, prediction: null, connectedAt: Date.now() };
        players.push(p);
      } else {
        p.profile = profile || p.profile;
        p.connectedAt = Date.now();
      }
      recomputeLeaderboard();
      io.emit('players_update', players);
      io.emit('state', { block: currentBlock, players, leaderboard });
      console.log('Player join:', fid);
    } catch (e) {
      console.error('join handler error', e);
    }
  });

  socket.on('submit_prediction', (data) => {
    try {
      const { fid, prediction } = data || {};
      if (!fid) return;
      const p = players.find(x => x.fid === fid);
      if (!p) return;
      p.prediction = prediction;
      p.lastPredictionAt = Date.now();
      io.emit('players_update', players);
      console.log('prediction from', fid, prediction);
    } catch (e) {
      console.error('submit_prediction error', e);
    }
  });

  socket.on('chat_message', (msg) => {
    try {
      const payload = { from: msg?.fid || 'anon', text: msg?.text || msg?.message || '', timestamp: Date.now() };
      io.emit('chat_message', payload);
      console.log('chat_message', payload.from, payload.text.slice(0,80));
    } catch (e) { console.error('chat_message error', e); }
  });

  socket.on('request_prev_block', () => socket.emit('block_update', currentBlock));
  socket.on('request_current_block', () => socket.emit('block_update', currentBlock));

  socket.on('disconnect', (reason) => { console.log('client disconnected', socket.id, reason); });
});

setInterval(() => { recomputeLeaderboard(); io.emit('state', { block: currentBlock, players, leaderboard }); }, 5000);

// Mempool websocket
let ws = null;
function startMempoolWs() {
  try {
    console.log('Connecting to mempool WS:', MEMPOOL_WS_URL);
    ws = new WebSocket(MEMPOOL_WS_URL);

    ws.on('open', () => {
      console.log('mempool ws open');
      try { ws.send(JSON.stringify({ op: 'unconfirmed_sub' })); ws.send(JSON.stringify({ op: 'blocks_sub' })); } catch(e) {}
    });

    ws.on('message', (raw) => {
      let parsed = null;
      try { parsed = JSON.parse(raw.toString()); } catch(e) { parsed = null; }

      if (parsed && parsed.op) {
        const op = parsed.op;
        if (op === 'utx' || op === 'tx') {
          handleIncomingTx(parsed.x || parsed.tx || parsed);
        } else if (op === 'block') {
          handleIncomingBlock(parsed.x || parsed.block || parsed);
        } else {
          io.emit('mempool_tx', parsed);
        }
      } else {
        // fallback: try detect simple patterns or forward raw
        try { io.emit('mempool_tx', JSON.parse(raw.toString())); } catch(e) { io.emit('mempool_tx', raw.toString()); }
      }
    });

    ws.on('close', (code, reason) => { console.warn('ws closed', code, reason && reason.toString()); setTimeout(startMempoolWs, 5000); });
    ws.on('error', (err) => { console.error('ws error', err && err.message); try{ ws.close(); } catch(e){} });
  } catch (e) {
    console.error('startMempoolWs error', e);
    setTimeout(startMempoolWs, 10000);
  }
}

function handleIncomingTx(tx) {
  try {
    const shortTx = {
      txid: tx.hash || tx.txid || tx?.x?.hash || null,
      fee: tx.fee || tx?.x?.fee,
      size: tx.size || tx?.x?.size,
      inputs: tx?.x?.inputs ? tx.x.inputs.length : undefined,
      outputs: tx?.x?.out ? tx.x.out.length : undefined,
      raw: tx,
      ts: Date.now()
    };
    recentTxs.unshift(shortTx);
    if (recentTxs.length > RECENT_TX_LIMIT) recentTxs.pop();
    io.emit('mempool_tx', shortTx);
  } catch (e) { console.error('handleIncomingTx error', e); }
}

function handleIncomingBlock(block) {
  try {
    const normalized = {
      number: block.height || block?.x?.height || null,
      hash: block.hash || block?.x?.hash || null,
      tx_count: block.n_tx || block?.x?.n_tx || null,
      timestamp: block.time || block?.x?.time || Date.now(),
      raw: block
    };
    currentBlock = normalized;
    io.emit('block_update', currentBlock);
    recomputeLeaderboard(); io.emit('state', { block: currentBlock, players, leaderboard });
    console.log('New block', normalized.number || normalized.hash);
  } catch (e) { console.error('handleIncomingBlock error', e); }
}

startMempoolWs();

// Block poll fallback
let lastPolledBlock = null;
async function pollBlockHeight() {
  if (!fetch || !BLOCK_POLL_URL) return;
  try {
    const res = await fetch(BLOCK_POLL_URL);
    if (!res.ok) return;
    const text = await res.text();
    const height = Number(text);
    if (!Number.isNaN(height) && height !== lastPolledBlock) {
      lastPolledBlock = height;
      currentBlock = { number: height, hash: null, timestamp: Date.now(), tx_count: null, raw: null };
      io.emit('block_update', currentBlock);
      recomputeLeaderboard(); io.emit('state', { block: currentBlock, players, leaderboard });
      console.log('Polled new block height', height);
    }
  } catch (e) {}
  setTimeout(pollBlockHeight, BLOCK_POLL_INTERVAL_MS).unref?.();
}
if (fetch) pollBlockHeight();

server.listen(PORT, () => console.log(`Backend server listening on ${PORT}`));

function shutdown() { console.log('Shutting down backend'); try { if (ws) ws.close(); } catch(e) {} try { server.close(); } catch(e) {} process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
