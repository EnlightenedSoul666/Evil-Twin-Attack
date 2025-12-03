const io = require('socket.io-client');
const crypto = require('crypto');
const { deriveSessionKey, computeMIC, encryptWithRandomKeyGCM } = require('../shared/crypto');

const URL = process.env.AP_URL || 'http://localhost:3000';
const deviceId = process.env.DEVICE_ID || 'DeviceX';
const PSK = 'correcthorsebattery';
const AP_BSSID = 'AP1';

const socket = io(URL, { transports: ['websocket'], reconnection: true });

let sessionKey = null;
let snonceHex = null;
let anonceHex = null;
let seq = 0;

function log(msg){ console.log(`[${deviceId}] ${msg}`); }

socket.on('connect', () => {
  socket.emit('device:register', { deviceId });
  snonceHex = crypto.randomBytes(16).toString('hex');
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
  seq = 0;
  setInterval(() => sendOnce(`hello from ${deviceId} @ ${new Date().toISOString()}`), 5000);
});

socket.on('device:send-demo', ({ text, targetId }) => {
  sendOnce(String(text||`hi from ${deviceId}`), targetId);
});

function sendOnce(plaintext, targetId){
  if (!sessionKey) return;
  const enc = encryptWithRandomKeyGCM(plaintext, deviceId); // {iv,ciphertext,authTag,aad,demoKeyHex}
  const ts = Date.now();
  const frame = { from: deviceId, targetId, ...enc, ts, seq: ++seq };
  socket.emit('uplink', frame);
}

socket.on('ap:ack', ({ ok, error }) => { if (!ok) log(`AP ack error: ${error}`); });
