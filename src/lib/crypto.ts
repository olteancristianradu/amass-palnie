import crypto from 'crypto';

// AES-256-GCM encryption pentru parolele CRM ale userilor.
// Cheia vine din env CRYPTO_KEY (32 bytes base64). Generăm o cheie nouă dacă nu există.

function getKey(): Buffer {
  const envKey = process.env.CRYPTO_KEY;
  if (envKey) return Buffer.from(envKey, 'base64');
  // În producție REFUZĂM să pornim cu cheie hardcodată — altfel parolele CRM ar fi
  // criptate cu o cheie publică (din cod) = compromise total.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRYPTO_KEY lipsește în producție. Setează o cheie AES-256 base64 (openssl rand -base64 32).');
  }
  // Fallback DOAR pentru dev local.
  return crypto.scryptSync('amass-dev-default-key', 'amass-salt', 32);
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, 'base64');
  // Validare lungime minimă (12 IV + 16 tag): input corupt/gol → eroare clară, nu un GCM criptic.
  if (buf.length < 28) throw new Error('decrypt: ciphertext invalid (prea scurt / corupt)');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const enc = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
