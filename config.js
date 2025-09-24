// ================================
// CONFIG FARCASTER MINI APP
// ================================

// Dynamic backend URL detection for Replit and local development
function getBackendURL() {
  // For Replit deployment - use the same domain as frontend
  if (window.location.hostname.includes('replit.app') || window.location.hostname.includes('replit.dev')) {
    return window.location.origin;
  }
  
  // For local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Fallback to current origin
  return window.location.origin;
}

window.BACKEND_URL = getBackendURL();

// Nama aplikasi (ditampilkan di header & sign message)
window.APP_NAME = "TX Battle Royale";

// Timeout splash screen (ms)
window.SPLASH_TIMEOUT = 5000;

// Chain config (kalau nanti mau konek ke Base/EVM)
window.CHAIN = {
  name: "Base Mainnet",
  chainId: "0x2105", // 8453 decimal
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"]
};