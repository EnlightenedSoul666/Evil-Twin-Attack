
# Secure Wi‑Fi Sim (Node, GUI + default devices)

**What you asked for:**
- Two devices appear by default from config (`Device1`, `Device2`).
- "Add Device" is implemented in the GUI (top-right panel).
- Fixed `npm run dev1`/`npm run dev2` scripts to avoid "Missing script" errors.

## Quick start
```bash
npm i
npm start          # AP + GUI at http://localhost:3000
```

Open a new terminal (optional simulators):
```bash
npm run dev1       # starts Device1 simulator
npm run dev2       # starts Device2 simulator
# or any name
DEVICE_ID=Device3 npm run dev
```

The GUI shows the two default devices immediately (offline until a simulator connects).
When a simulator connects, it turns **online**, handshakes, and starts sending encrypted messages
that the AP decrypts successfully.
