/**
 * 加密工具函数
 * 使用 Web Crypto API（Cloudflare Workers 兼容）
 */

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    const rounds = 10;
    return bcrypt.hash(password, rounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
}

/**
 * Encrypt text using Web Crypto API (AES-GCM)
 */
export async function encrypt(text: string, encryptionKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        data
    );

    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt text using Web Crypto API (AES-GCM)
 */
export async function decrypt(encryptedText: string, encryptionKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const encrypted = Uint8Array.from(atob(encryptedText), (c) => c.charCodeAt(0));

    const salt = encrypted.slice(0, 16);
    const iv = encrypted.slice(16, 28);
    const data = encrypted.slice(28);

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        data
    );

    return decoder.decode(decrypted);
}

/**
 * Encrypt API Key for secure storage
 */
export async function encryptApiKey(apiKey: string, encryptionKey: string): Promise<string> {
    return encrypt(apiKey, encryptionKey);
}

/**
 * Decrypt API Key from database
 */
export async function decryptApiKey(encryptedApiKey: string, encryptionKey: string): Promise<string> {
    return decrypt(encryptedApiKey, encryptionKey);
}
