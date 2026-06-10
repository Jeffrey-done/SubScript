const PBKDF2_ITERATIONS = 210000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const AUTH_RATE_LIMIT_MAX = 8;
const MAX_REQUEST_BYTES = 1_000_000;
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = getAllowedOrigins(env);
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResp({ success: false, error: 'Forbidden origin' }, 403, {});
    }

    const corsHeaders = buildCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env.SUBSCRIPT_DB) {
        return jsonResp({ success: false, error: "KV Binding 'SUBSCRIPT_DB' not found. Please configure in Cloudflare Dashboard." }, 500, corsHeaders);
      }

      try {
        if (url.pathname === '/api/auth/register' && request.method === 'POST') {
          const rateLimit = await checkAuthRateLimit(env, request);
          if (!rateLimit.allowed) {
            return jsonResp({ success: false, error: 'Too many requests, please try again later.' }, 429, corsHeaders);
          }

          const { username, password } = await request.json();
          const normalizedUsername = normalizeUsername(username);
          if (!normalizedUsername || !isValidPassword(password)) {
            return jsonResp({ success: false, error: 'Invalid username or password (username: 3-32 chars, password required)' }, 400, corsHeaders);
          }

          const existing = await env.SUBSCRIPT_DB.get(userKey(normalizedUsername));
          if (existing) {
            return jsonResp({ success: false, error: 'Username already exists' }, 409, corsHeaders);
          }

          const salt = crypto.randomUUID();
          const hash = await hashPasswordPBKDF2(password, salt);
          await env.SUBSCRIPT_DB.put(userKey(normalizedUsername), JSON.stringify({ hash, salt, algo: 'pbkdf2', iterations: PBKDF2_ITERATIONS }));
          return jsonResp({ success: true }, 200, corsHeaders);
        }

        if (url.pathname === '/api/auth/login' && request.method === 'POST') {
          const rateLimit = await checkAuthRateLimit(env, request);
          if (!rateLimit.allowed) {
            return jsonResp({ success: false, error: 'Too many requests, please try again later.' }, 429, corsHeaders);
          }

          const { username, password } = await request.json();
          const normalizedUsername = normalizeUsername(username);
          if (!normalizedUsername || !isValidPassword(password)) {
            return jsonResp({ success: false, error: 'Invalid username or password' }, 400, corsHeaders);
          }

          const userRaw = await env.SUBSCRIPT_DB.get(userKey(normalizedUsername));
          if (!userRaw) {
            return jsonResp({ success: false, error: 'User not found' }, 404, corsHeaders);
          }

          const user = safeJsonParse(userRaw);
          if (!user || typeof user.hash !== 'string' || typeof user.salt !== 'string') {
            return jsonResp({ success: false, error: 'User record is corrupted' }, 500, corsHeaders);
          }

          const passwordOk = user.algo === 'pbkdf2'
            ? await verifyPasswordPBKDF2(password, user.salt, user.hash)
            : await verifyPasswordLegacy(password, user.salt, user.hash);

          if (!passwordOk) {
            return jsonResp({ success: false, error: 'Invalid password' }, 401, corsHeaders);
          }

          if (user.algo !== 'pbkdf2') {
            const upgradedSalt = crypto.randomUUID();
            const upgradedHash = await hashPasswordPBKDF2(password, upgradedSalt);
            await env.SUBSCRIPT_DB.put(userKey(normalizedUsername), JSON.stringify({ hash: upgradedHash, salt: upgradedSalt, algo: 'pbkdf2', iterations: PBKDF2_ITERATIONS }));
          }

          const token = crypto.randomUUID();
          await env.SUBSCRIPT_DB.put(sessionKey(token), normalizedUsername, { expirationTtl: SESSION_TTL_SECONDS });
          return jsonResp({ success: true, data: { token } }, 200, corsHeaders);
        }

        if (url.pathname === '/api/sync/push' && request.method === 'POST') {
          const token = request.headers.get('Authorization');
          const username = await getUsernameByToken(env, token);
          if (!username) return jsonResp({ success: false, error: 'Unauthorized' }, 401, corsHeaders);

          if (isRequestTooLarge(request)) {
            return jsonResp({ success: false, error: 'Payload too large' }, 413, corsHeaders);
          }

          const data = await request.json();
          await env.SUBSCRIPT_DB.put(dataKey(username), JSON.stringify(data));
          return jsonResp({ success: true }, 200, corsHeaders);
        }

        if (url.pathname === '/api/sync/pull' && request.method === 'GET') {
          const token = request.headers.get('Authorization');
          const username = await getUsernameByToken(env, token);
          if (!username) return jsonResp({ success: false, error: 'Unauthorized' }, 401, corsHeaders);

          const data = await env.SUBSCRIPT_DB.get(dataKey(username));
          return jsonResp({ success: true, data: data ? safeJsonParse(data) : null }, 200, corsHeaders);
        }

        return jsonResp({ success: false, error: 'Endpoint not found' }, 404, corsHeaders);
      } catch (e) {
        return jsonResp({ success: false, error: e?.message || 'Internal server error' }, 500, corsHeaders);
      }
    }

    const targetHost = 'maas-api.cn-huabei-1.xf-yun.com';
    const targetUrl = new URL(request.url);
    targetUrl.hostname = targetHost;
    targetUrl.protocol = 'https:';

    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        Host: targetHost,
        'Content-Type': 'application/json',
      },
      body: request.body,
    });

    let response;
    try {
      response = await fetch(newRequest);
    } catch (e) {
      return jsonResp({ error: e?.message || 'Upstream fetch failed' }, 500, corsHeaders);
    }

    const newResponse = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newResponse.headers.set(key, value);
    });
    return newResponse;
  },
};

function userKey(username) {
  return `u:${username}`;
}

function sessionKey(token) {
  return `s:${token}`;
}

function dataKey(username) {
  return `d:${username}`;
}

function buildCorsHeaders(origin) {
  if (!origin) {
    return {
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Origin, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function getAllowedOrigins(env) {
  const raw = typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS : '';
  const origins = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS);
}

function jsonResp(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function normalizeUsername(username) {
  if (typeof username !== 'string') return null;
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(trimmed)) return null;
  return trimmed;
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 256;
}

function isRequestTooLarge(request) {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return false;
  const length = Number(contentLength);
  return Number.isFinite(length) && length > MAX_REQUEST_BYTES;
}

async function checkAuthRateLimit(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const windowId = Math.floor(Date.now() / (AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000));
  const key = `rl:auth:${ip}:${windowId}`;
  const current = Number(await env.SUBSCRIPT_DB.get(key) || 0);
  const next = current + 1;
  await env.SUBSCRIPT_DB.put(key, String(next), { expirationTtl: AUTH_RATE_LIMIT_WINDOW_SECONDS + 60 });
  return { allowed: next <= AUTH_RATE_LIMIT_MAX, remaining: Math.max(0, AUTH_RATE_LIMIT_MAX - next) };
}

async function hashPasswordPBKDF2(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = encoder.encode(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );
  return bytesToHex(bits);
}

async function verifyPasswordPBKDF2(password, salt, expectedHash) {
  const hash = await hashPasswordPBKDF2(password, salt);
  return timingSafeEqual(hash, expectedHash);
}

async function verifyPasswordLegacy(password, salt, expectedHash) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = bytesToHex(hashBuffer);
  return timingSafeEqual(hash, expectedHash);
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getUsernameByToken(env, token) {
  if (!token) return null;
  return await env.SUBSCRIPT_DB.get(sessionKey(token));
}
