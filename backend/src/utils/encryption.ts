import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives a key from the encryption key using PBKDF2
 */
function getKey(salt: Buffer): Buffer {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
    }

    return crypto.pbkdf2Sync(encryptionKey, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts text using AES-256-GCM
 */
export function encrypt(text: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = getKey(salt);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    return result.toString('base64');
}

/**
 * Decrypts text that was encrypted with the encrypt function
 */
export function decrypt(encryptedText: string): string {
    const buffer = Buffer.from(encryptedText, 'base64');

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = getKey(salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString('utf8');
}

/**
 * Hash password using bcrypt (wrapper for future use)
 */
export async function hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    return bcrypt.hash(password, rounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = require('bcrypt');
    return bcrypt.compare(password, hash);
}

/**
 * Encrypt API Key for secure storage
 */
export function encryptApiKey(apiKey: string): string {
    return encrypt(apiKey);
}

/**
 * Decrypt API Key from database
 */
export function decryptApiKey(encryptedApiKey: string): string {
    return decrypt(encryptedApiKey);
}

