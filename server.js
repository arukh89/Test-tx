const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Start the backend server
console.log('Starting backend server...');
const backend = spawn('node', ['backend/server.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

backend.on('error', (err) => {
  console.error('Backend server error:', err);
});

// Give backend more time to start and become ready
setTimeout(() => {
  console.log('Backend should be ready now');
}, 5000);

// Serve static files from the root directory
app.use(express.static('.'));

// Proxy API requests to the backend
app.use('/socket.io', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  ws: true
}));

// Expose backend API routes under /api path
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '' // Remove /api prefix when forwarding to backend
  }
}));

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
});