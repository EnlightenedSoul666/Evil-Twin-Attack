// shared/crypto.js
const crypto = require('crypto');

/* WPA-like demo derivation kept for completeness (not used by random-key demo) */
function deriveSessionKey(pskUtf8, anonceHex, snonceHex, deviceId, apBssid) {
  const label = Buffer.from('demo-ptk', 'utf8');
  const anonce = Buffer.from(anonceHex, 'hex');
  const snonce = Buffer.from(snonceHex, 'hex');
  const msg = Buffer.concat([label, anonce, snonce, Buffer.from(deviceId), Buffer.from(apBssid)]);
  return crypto.createHmac('sha256', Buffer.from(pskUtf8)).update(msg).digest();
}
function computeMIC(pskUtf8, anonceHex, snonceHex) {
  const anonce = Buffer.from(anonceHex, 'hex');
  const snonce = Buffer.from(snonceHex, 'hex');
  return crypto.createHmac('sha256', Buffer.from(pskUtf8))
               .update(Buffer.concat([anonce, snonce])).digest('hex');
}

/* AES-256-GCM helpers */
function encryptGCM(keyBuf32, plaintextUtf8, aadUtf8) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf32, iv);
  if (aadUtf8) cipher.setAAD(Buffer.from(aadUtf8));
  const ct = Buffer.concat([cipher.update(plaintextUtf8, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), ciphertext: ct.toString('hex'), authTag: tag.toString('hex'), aad: aadUtf8 || '' };
}
function decryptGCM(keyBuf32, ivHex, ciphertextHex, authTagHex, aadUtf8) {
  const iv = Buffer.from(ivHex, 'hex');
  const ct = Buffer.from(ciphertextHex, 'hex');
  const tag = Buffer.from(authTagHex, 'hex');
  const dec = crypto.createDecipheriv('aes-256-gcm', keyBuf32, iv);
  if (aadUtf8) dec.setAAD(Buffer.from(aadUtf8));
  dec.setAuthTag(tag);
  const pt = Buffer.concat([dec.update(ct), dec.final()]);
  return pt.toString('utf8');
}

/* Demo: encrypt with a FRESH random 32-byte key (returned to the UI for learning) */
function encryptWithRandomKeyGCM(plaintextUtf8, aadUtf8) {
  const key = crypto.randomBytes(32);
  const pkt = encryptGCM(key, plaintextUtf8, aadUtf8);
  return { ...pkt, demoKeyHex: key.toString('hex'), alg: 'AES-256-GCM' };
}

module.exports = {
  deriveSessionKey, computeMIC,
  encryptGCM, decryptGCM,
  encryptWithRandomKeyGCM,
};
