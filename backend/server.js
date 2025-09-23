// backend/server.js
// Real-time backend for TX Battle Royale
// - Socket.IO server to broadcast live mempool & block events to clients
// - Subscribes to a public mempool/block websocket (configurable via env)
// - Handles join / submit_prediction / chat_message and exposes simple in-memory state
// - LISTEN PORT is process.env.PORT || 3001 (server.js spawns this with PORT=3001)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
let fetch;
try {
  // Node 18+ has global fetch; otherwise try node-fetch
  fetch = global.fetch || require('node-fetch');
} catch (e) {
  fetch = null;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3001;

// Configurable mempool / block websocket URL (default: blockchain.info websocket)
const MEMPOOL_WS_URL = process.env.MEMPOOL_WS_URL || 'wss://ws.blockchain.info/inv';
// Optional: a simple HTTP block poll fallback (Blockstream API)
const BLOCK_POLL_URL = process.env.BLOCK_POLL_URL || 'https://blockstream.info/api/blocks/tip/height';
const BLOCK_POLL_INTERVAL_MS = Number(process.env.BLOCK_POLL_INTERVAL_MS || 20_000);

// ---------------------------
// In-memory state
// ---------------------------
let players = []; // { fid, name, profile, score, prediction }
let leaderboard = []; // derived from players
let currentBlock = null; // { number, hash, timestamp, tx_count, ... }
let recentTxs = []; // small ring of recent txs forwarded from mempool
const RECENT_TX_LIMIT = 100;

// Helper to update leaderboard (simple sort by score desc)
function recomputeLeaderboard() {
  leaderboard = players
    .map(p => ({ fid: p.fid, name: p.profile?.name || p.name || p.fid, score: Number(p.score || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

// ---------------------------
// Express minimal endpoints (optional health & API)
// ---------------------------
app.get('/', (req, res) => {
  res.send('TX Battle Royale backend is running');
});

app.get('/state', (req, res) => {
  recomputeLeaderboard();
  res.json({
    currentBlock,
    players,
    leaderboard,
    recentTxsCount: recentTxs.length,
  });
});

// ---------------------------
// Socket.IO events to clients
// ---------------------------
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // Send initial state
  recomputeLeaderboard();
  socket.emit('state', { block: currentBlock, players, leaderboard });

  // JOIN: client requests to join as a player
  socket.on('join', (payload) => {
    try {
      const { fid, profile } = payload || {};
      if (!fid) {
        socket.emit('error', { message: 'join requires fid' });
        return;
      }
      // find or create player
      let p = players.find(x => x.fid === fid);
      if (!p) {
        p = {
          fid,
          name: profile?.name || `guest-${fid.slice(-6)}`,
          profile: profile || {},
          score: 0,
          prediction: null,
          connectedAt: Date.now(),
        };
        players.push(p);
      } else {
        // update profile if provided
        p.profile = profile || p.profile;
        p.connectedAt = Date.now();
      }
      recomputeLeaderboard();
      // broadcast players update and state
      io.emit('players_update', players);
      io.emit('state', { block: currentBlock, players, leaderboard });
      console.log(`Player join: ${fid}`);
    } catch (e) {
      console.error('join handler error', e);
    }
  });

  // SUBMIT PREDICTION
  socket.on('submit_prediction', (data) => {
    try {
      const { fid, prediction } = data || {};
      if (!fid) return;
      const p = players.find(x => x.fid === fid);
      if (!p) return;
      p.prediction = prediction;
      p.lastPredictionAt = Date.now();
      // Broadcast that players changed
      io.emit('players_update', players);
      console.log(`Prediction from ${fid}: ${prediction}`);
    } catch (e) {
      console.error('submit_prediction error', e);
    }
  });

  // CHAT
  socket.on('chat_message', (msg) => {
    try {
      const payload = {
        from: msg?.fid || 'anon',
        text: msg?.text || msg?.message || '',
        timestamp: Date.now(),
      };
      // Broadcast chat_message to all clients
      io.emit('chat_message', payload);
      console.log('chat_message', payload.from, payload.text.slice(0, 80));
    } catch (e) {
      console.error('chat_message error', e);
    }
  });

  // Request previous/current block
  socket.on('request_prev_block', () => {
    // For simple backend, we don't persist old blocks; respond with currentBlock
    socket.emit('block_update', currentBlock);
  });
  socket.on('request_current_block', () => {
    socket.emit('block_update', currentBlock);
  });

  socket.on('disconnect', (reason) => {
    // optional: mark player disconnected
    console.log('Client disconnected', socket.id, reason);
  });
});

// Periodically broadcast state to all clients to keep them in sync
setInterval(() => {
  recomputeLeaderboard();
  io.emit('state', { block: currentBlock, players, leaderboard });
}, 5000);

// ---------------------------
// Mempool / Block WebSocket subscription
// ---------------------------
let ws = null;
let wsConnected = false;

function startMempoolWs() {
  try {
    console.log('Connecting to mempool WS', MEMPOOL_WS_URL);
    ws = new WebSocket(MEMPOOL_WS_URL);

    ws.on('open', () => {
      wsConnected = true;
      console.log('Mempool WS connected');

      // If using blockchain.info WS, subscribe to unconfirmed txs & blocks.
      // Message formats can differ by provider. Common for blockchain.info:
      //   {"op":"unconfirmed_sub"} and {"op":"blocks_sub"}
      // We'll try sending both — harmless if provider ignores unknown ops.
      try {
        ws.send(JSON.stringify({ op: 'unconfirmed_sub' }));
        ws.send(JSON.stringify({ op: 'blocks_sub' }));
      } catch (e) {
        // ignore
      }
    });

    ws.on('message', (data) => {
      // Many providers send JSON strings or raw binary. Try parse.
      let parsed = null;
      try {
        parsed = JSON.parse(data.toString());
      } catch (e) {
        // not JSON — forward raw string
      }

      if (parsed && parsed.op) {
        // blockchain.info style messages have 'op' key:
        // - op === 'utx' (unconfirmed tx)
        // - op === 'block' (new block)
        const op = parsed.op;
        if (op === 'utx' || op === 'tx' || op === 'mempool_tx') {
          // forward transaction
          const tx = parsed.x || parsed.tx || parsed;
          handleIncomingTx(tx);
        } else if (op === 'block' || op === 'new_block') {
          const block = parsed.x || parsed.block || parsed;
          handleIncomingBlock(block);
        } else {
          // fallback: forward raw message under mempool_tx for visibility
          io.emit('mempool_tx', parsed);
        }
      } else {
        // If parsing failed, try to detect substrings like '"op":"utx"' etc.
        const s = data.toString();
        if (s.includes('"op":"utx"') || s.includes('"op":"tx"')) {
          try {
            const p = JSON.parse(s);
            handleIncomingTx(p.x || p.tx || p);
          } catch (_) {
            io.emit('mempool_tx', s);
          }
        } else if (s.includes('"op":"block"')) {
          try {
            const p = JSON.parse(s);
            handleIncomingBlock(p.x || p.block || p);
          } catch (_) {
            io.emit('mempool_tx', s);
          }
        } else {
          // unknown format: emit for debugging
          io.emit('mempool_tx', s);
        }
      }
    });

    ws.on('close', (code, reason) => {
      wsConnected = false;
      console.warn('Mempool WS closed', code, reason && reason.toString());
      // reconnect after delay
      setTimeout(startMempoolWs, 5000);
    });

    ws.on('error', (err) => {
      wsConnected = false;
      console.error('Mempool WS error', err && err.message);
      try { ws.close(); } catch (e) {}
    });
  } catch (e) {
    console.error('startMempoolWs error', e && e.message);
    setTimeout(startMempoolWs, 10_000);
  }
}

// handle tx: keep recentTxs ring and broadcast
function handleIncomingTx(tx) {
  try {
    // tx may contain many fields; keep trimmed version for clients
    const shortTx = {
      txid: tx.hash || tx.txid || tx?.x?.hash || null,
      fee: tx.fee || tx?.x?.fee,
      size: tx.size || tx?.x?.size,
      inputs: tx?.x?.inputs ? tx.x.inputs.length : undefined,
      outputs: tx?.x?.out ? tx.x.out.length : undefined,
      raw: tx, // raw object for clients who want details
      ts: Date.now()
    };
    recentTxs.unshift(shortTx);
    if (recentTxs.length > RECENT_TX_LIMIT) recentTxs.pop();

    // Broadcast mempool transaction to clients
    io.emit('mempool_tx', shortTx);
  } catch (e) {
    console.error('handleIncomingTx error', e);
  }
}

// handle block: set currentBlock and broadcast
function handleIncomingBlock(block) {
  try {
    // Normalize block object if provider gives different shape
    const normalized = {
      number: block.height || block?.x?.height || block.height || null,
      hash: block.hash || block?.x?.hash || block?.x?.id || null,
      tx_count: block.n_tx || block?.x?.n_tx || null,
      timestamp: block.time || block?.x?.time || Date.now(),
      raw: block
    };
    currentBlock = normalized;

    // When a new block arrives, you may want to evaluate predictions:
    // The app currently does not implement domain-specific scoring rules.
    // If you want automatic scoring, implement logic here to evaluate player.prediction
    // against this block and adjust p.score accordingly.

    io.emit('block_update', currentBlock);
    // Also emit an overall state update
    recomputeLeaderboard();
    io.emit('state', { block: currentBlock, players, leaderboard });
    console.log('New block', normalized.number || normalized.hash);
  } catch (e) {
    console.error('handleIncomingBlock error', e);
  }
}

// ---------------------------
// Fallback: poll block height occasionally (if websocket provider not reliable)
// ---------------------------
let lastPolledBlockHeight = null;
async function pollBlockHeight() {
  if (!fetch || !BLOCK_POLL_URL) return;
  try {
    const res = await fetch(BLOCK_POLL_URL, { timeout: 5000 });
    if (!res.ok) return;
    const text = await res.text();
    const height = Number(text);
    if (!Number.isNaN(height) && height !== lastPolledBlockHeight) {
      lastPolledBlockHeight = height;
      // For a polled height change, fetch more details may be necessary.
      // We'll broadcast a basic block update (height changed).
      currentBlock = {
        number: height,
        hash: null,
        timestamp: Date.now(),
        tx_count: null,
        raw: null,
      };
      io.emit('block_update', currentBlock);
      recomputeLeaderboard();
      io.emit('state', { block: currentBlock, players, leaderboard });
      console.log('Polled new block height', height);
    }
  } catch (e) {
    // ignore polling failures
  } finally {
    setTimeout(pollBlockHeight, BLOCK_POLL_INTERVAL_MS).unref?.();
  }
}

// Start mempool WS and polling
startMempoolWs();
if (fetch) pollBlockHeight();

// ---------------------------
// Start HTTP server
// ---------------------------
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

// ---------------------------
// Graceful shutdown
// ---------------------------
function shutdown() {
  console.log('Shutting down backend...');
  try { if (ws) ws.close(); } catch (e) {}
  try { server.close(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
