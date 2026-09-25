import crypto from 'node:crypto';

// Default fallback key if user hasn't set custom one via UI or ENV
const ENV_MASTER_KEY = process.env.GATEWAY_ENCRYPTION_KEY || 'edgeai-default-master-key-change-in-ui-vault-9902';
let runtimeMasterKey = ENV_MASTER_KEY;

export function setRuntimeMasterKey(key: string) {
  if (key && key.trim().length >= 8) {
    runtimeMasterKey = key.trim();
    return true;
  }
  return false;
}

export function getRuntimeMasterKey(): string {
  return runtimeMasterKey;
}

export function isMasterKeyCustomized(): boolean {
  return runtimeMasterKey !== 'edgeai-default-master-key-change-in-ui-vault-9902';
}

/**
 * Derives a 256-bit key from passphrase and salt using PBKDF2
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt plaintext string using AES-256-GCM
 * Output format: "aes256gcm:saltHex:ivHex:authTagHex:ciphertextHex"
 */
export function encryptSecret(plainText: string, customPassphrase?: string): string {
  if (!plainText) return '';
  const passphrase = customPassphrase || runtimeMasterKey;
  const salt = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plainText, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `aes256gcm:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypt string encrypted with AES-256-GCM
 */
export function decryptSecret(encryptedPayload: string, customPassphrase?: string): string {
  if (!encryptedPayload) return '';
  if (!encryptedPayload.startsWith('aes256gcm:')) {
    // If not encrypted in new format, return as-is for backward compatibility
    return encryptedPayload;
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted payload format');
  }

  const [, saltHex, ivHex, authTagHex, ciphertextHex] = parts;
  const passphrase = customPassphrase || runtimeMasterKey;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks an API key for safe UI display (e.g., "AIzaSy...4x9A")
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  const prefix = apiKey.slice(0, 6);
  const suffix = apiKey.slice(-4);
  return `${prefix}••••${suffix}`;
}

/**
 * Secure password hashing for Admin
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt ? Buffer.from(existingSalt, 'hex') : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: salt.toString('hex') };
}

export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Generate virtual Gateway API keys (e.g., "gw-sk-live-...")
 */
export function generateGatewayApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const random = crypto.randomBytes(24).toString('base64url');
  const rawKey = `gw-live-${random}`;
  const keyPrefix = rawKey.slice(0, 14) + '...';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyPrefix, keyHash };
}
