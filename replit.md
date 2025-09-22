# TX Battle Royale

## Overview
TX Battle Royale is a real-time Bitcoin transaction prediction game where users compete to predict the number of transactions in the next Bitcoin block. The application uses real-time data from mempool.space API and features live chat, leaderboards, and Socket.IO for real-time communication.

## Project Architecture
- **Frontend**: Static HTML/CSS/JS served by Express server on port 5000
- **Backend**: Node.js Express server with Socket.IO on port 3001
- **Real-time Communication**: Socket.IO for live updates and chat
- **External API**: mempool.space for Bitcoin block data

## Recent Changes (Sept 22, 2025)
- Set up Replit environment with Node.js 18
- Configured frontend server with proxy to backend
- Set up single workflow that manages both frontend and backend servers
- Configured deployment for VM target to support persistent connections
- Frontend serves on port 5000 (0.0.0.0) for Replit proxy compatibility
- Backend runs on port 3001 (localhost) with CORS enabled

## File Structure
```
/
├── index.html          # Frontend HTML
├── app.js             # Frontend JavaScript (Socket.IO client)
├── style.css          # Frontend styles
├── server.js          # Frontend server (Express + proxy)
├── package.json       # Frontend dependencies
├── backend/
│   ├── server.js      # Backend server (Express + Socket.IO)
│   ├── package.json   # Backend dependencies
│   └── replit.nix     # Nix configuration
└── icons/             # Application icons
```

## Key Features
- Real-time Bitcoin block monitoring
- Transaction prediction system
- Live chat functionality
- Player leaderboard
- Farcaster integration support
- Responsive web interface

## Technology Stack
- Node.js 18
- Express.js
- Socket.IO
- HTML/CSS/JavaScript
- mempool.space API