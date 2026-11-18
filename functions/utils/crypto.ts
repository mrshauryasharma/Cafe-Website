// Pure Web Standards Cryptography Utilities (No Node modules)

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DEFAULT_JWT_SECRET = 'cafe-loyalty-secret-key-prod-d1-cloudflare-2024-token-signature';

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(strOrBytes: string | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof strOrBytes === 'string') {
    bytes = encoder.encode(strOrBytes);
  } else {
    bytes = strOrBytes;
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * PBKDF2 Password Hashing using Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return `${bufferToHex(salt)}:${bufferToHex(derivedBits)}`;
}

/**
 * PBKDF2 Password Verification
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, originalHashHex] = parts;
  const salt = hexToUint8Array(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const computedHashHex = bufferToHex(derivedBits);
  if (computedHashHex.length !== originalHashHex.length) return false;

  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < computedHashHex.length; i++) {
    diff |= computedHashHex.charCodeAt(i) ^ originalHashHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * HMAC-SHA256 JWT Creation
 */
export async function createJwt<T extends object>(
  payload: T,
  secret: string,
  expiresInSeconds = 86400
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || DEFAULT_JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * HMAC-SHA256 JWT Verification
 */
export async function verifyJwt<T>(token: string, secret: string): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const dataToVerify = `${encodedHeader}.${encodedPayload}`;
    const signature = base64UrlDecode(encodedSignature);

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret || DEFAULT_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signature as unknown as BufferSource, encoder.encode(dataToVerify));
    if (!isValid) return null;

    const payloadJson = decoder.decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadJson) as T & { exp?: number };

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Cookie parsing & setting
 */
export function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  });
  return cookies;
}

export function createAuthCookie(token: string, maxAgeSeconds = 86400): string {
  return `auth_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearAuthCookie(): string {
  return `auth_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
