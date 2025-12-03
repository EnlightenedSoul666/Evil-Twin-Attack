
const io = require('socket.io-client');
const crypto = require('crypto');
const { deriveSessionKey, encryptGCM, computeMIC } = require('../shared/crypto');

const URL = process.env.AP_URL || 'http://localhost:3000';
const deviceId = process.env.DEVICE_ID || 'Device1';
const PSK = 'correcthorsebattery';
const AP_BSSID = 'AP1';

const socket = io(URL, { transports: ['websocket'], reconnection: true });

let sessionKey = null;
let snonceHex = null;
let anonceHex = null;

function log(msg) { console.log(`[${deviceId}] ${msg}`); }

socket.on('connect', () => {
  log(`Connected to AP ${URL}`);
  socket.emit('device:register', { deviceId });

  snonceHex = crypto.randomBytes(16).toString('hex');
  log(`Initiating handshake with nonce ${snonceHex}`);
  socket.emit('handshake:init', { deviceId, snonceHex });
});

socket.on('handshake:ap', ({ deviceId: id, anonceHex: a }) => {
  if (id !== deviceId) return;
  anonceHex = a;
  const micHex = computeMIC(PSK, anonceHex, snonceHex);
  socket.emit('handshake:complete', { deviceId, micHex });
});

socket.on('handshake:result', ({ deviceId: id, ok }) => {
  if (id !== deviceId) return;
  if (!ok) return log('Handshake FAILED');
  sessionKey = deriveSessionKey(PSK, anonceHex, snonceHex, deviceId, AP_BSSID);
  log(`Handshake OK. Session key: ${sessionKey.toString('hex').slice(0,16)}...`);
  sendLoop();
});

function sendLoop() {
  setInterval(() => {
    if (!sessionKey) return;
    const msg = `hello from ${deviceId} @ ${new Date().toISOString()}`;
    const pkt = encryptGCM(sessionKey, msg, deviceId);
    socket.emit('uplink', { from: deviceId, ...pkt });
  }, 2000);
}

socket.on('ap:ack', ({ ok, error }) => {
  if (!ok) log(`AP ack error: ${error}`);
});
