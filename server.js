// server.js
// Minimal server for the Secure Wi-Fi Simulator
// - Serves the frontend from ./public
// - Keeps a small in-memory topology
// - Socket.IO: sends topology to clients
// - POST /api/device/add  -> add a device
// - POST /api/keys/save   -> save per-node RSA keys (HEX) to ./keys/<id>.keys.txt

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

// --- middlewares
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// --- in-memory topology -------------------------------------------------
const topology = {
  // One default AP (others can be created client-side as "local" APs if you prefer)
  aps: [{ id: 'AP1', name: 'AP1', rogue: false }],
  // Two default devices so the canvas isn't empty
  devices: [
    { id: 'Device1', name: 'Device1' },
    { id: 'Device2', name: 'Device2' },
    // { id: 'Device3', name: 'Device3' }, // uncomment if you want a third by default
  ],
};

// --- socket.io ----------------------------------------------------------
const io = new Server(server, {
  cors: { origin: '*' },
});

function broadcastTopology() {
  io.emit('topology:update', topology);
}

io.on('connection', (socket) => {
  console.log('client connected:', socket.id);

  // first push
  socket.emit('topology:full', topology);

  socket.on('topology:get', () => {
    socket.emit('topology:full', topology);
  });

  // These two events are kept for compatibility with older UIs
  socket.on('packet:uplink', (p) => {
    // The latest UI does client-side animation; we still relay for backward compat
    socket.broadcast.emit('packet:uplink', p);
  });
  socket.on('packet:downlink', (p) => {
    socket.broadcast.emit('packet:downlink', p);
  });

  socket.on('disconnect', () => {
    console.log('client disconnected:', socket.id);
  });
});

// --- routes -------------------------------------------------------------

// Add a device (UI calls this when you click "Add Device")
app.post('/api/device/add', (req, res) => {
  const id = String((req.body && req.body.deviceId) || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'deviceId required' });

  const exists = topology.devices.some((d) => d.id === id);
  if (!exists) {
    topology.devices.push({ id, name: id });
    broadcastTopology();
  }
  return res.json({ ok: true, topology });
});

// Save per-node RSA keys in HEX to ./keys/<id>.keys.txt
const KEYS_DIR = path.join(__dirname, 'keys');

app.post('/api/keys/save', async (req, res) => {
  try {
    const { id, pubHex, privHex } = req.body || {};
    if (!id || !pubHex || !privHex) {
      return res.status(400).json({ ok: false, error: 'Missing id/pubHex/privHex' });
    }

    await fs.promises.mkdir(KEYS_DIR, { recursive: true });

    const file = path.join(KEYS_DIR, `${id}.keys.txt`);
    const contents =
`# RSA-OAEP-256 keys (HEX) for ${id}
# Saved: ${new Date().toISOString()}

-----BEGIN PUBLIC KEY HEX-----
${pubHex.match(/.{1,64}/g).join('\n')}
-----END PUBLIC KEY HEX-----

-----BEGIN PRIVATE KEY HEX-----
${privHex.match(/.{1,64}/g).join('\n')}
-----END PRIVATE KEY HEX-----
`;

    await fs.promises.writeFile(file, contents, 'utf8');
    return res.json({ ok: true });
  } catch (err) {
    console.error('save keys error:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// SPA fallback (optional, handy if you later add client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- start --------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
