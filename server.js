const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files from the root directory
app.use(express.static('.'));

// Proxy API requests to the backend
app.use('/socket.io', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  ws: true
}));

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on http://0.0.0.0:${PORT}`);
});