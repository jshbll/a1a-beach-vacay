const LODGIFY_API_BASE = 'https://api.lodgify.com/v2';
const DEFAULT_WEBSITE_ID = '410037';
const CACHE_KEY = 'lodgify:properties:v1';
const COOLDOWN_KEY = 'lodgify:refresh-cooldown:v1';
const REFRESH_LOCK_KEY = 'lodgify:refresh-lock:v1';
const DEFAULT_PUBLIC_CACHE_TTL_SECONDS = 60;
const DEFAULT_STALE_WHILE_REVALIDATE_SECONDS = 300;
const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 900;
const DEFAULT_ROOM_FETCH_CONCURRENCY = 1;
const DEFAULT_ROOM_FETCH_DELAY_MS = 300;
const LOCK_TTL_SECONDS = 120;

class UpstreamError extends Error {
  constructor(status, retryAfter) {
    super(`Lodgify request failed with status ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      if (request.method !== 'GET') {
        return withCors(jsonResponse({ error: 'Method not allowed' }, 405), corsHeaders);
      }

      const cached = await readCachedProperties(env);
      const cooldown = await readRefreshCooldown(env);

      return withCors(jsonResponse({
        ok: true,
        cache_ready: Boolean(cached),
        refreshed_at: cached?.refreshed_at || null,
        cooldown_until: cooldown?.until || null
      }), corsHeaders);
    }

    if (url.pathname === '/admin/refresh') {
      if (request.method !== 'POST') {
        return withCors(jsonResponse({ error: 'Method not allowed' }, 405), corsHeaders);
      }

      const authorized = await isAuthorizedAdminRequest(request, env);

      if (!authorized) {
        return withCors(jsonResponse({ error: 'Unauthorized' }, 401, {
          'www-authenticate': 'Bearer'
        }), corsHeaders);
      }

      const result = await refreshCachedProperties(env, {
        force: url.searchParams.get('force') === '1',
        reason: 'manual'
      });

      return withCors(jsonResponse(result, result.status || 200, {
        'cache-control': 'no-store'
      }), corsHeaders);
    }

    if (url.pathname !== '/properties') {
      return withCors(jsonResponse({ error: 'Not found' }, 404), corsHeaders);
    }

    if (request.method !== 'GET') {
      return withCors(jsonResponse({ error: 'Method not allowed' }, 405), corsHeaders);
    }

    const cached = await readCachedProperties(env);

    if (!cached) {
      return withCors(jsonResponse({
        error: 'Properties cache is warming',
        retry_after: 300
      }, 503, {
        'cache-control': 'no-store',
        'retry-after': '300',
        'x-a1a-cache': 'miss'
      }), corsHeaders);
    }

    return withCors(jsonResponse(cached.payload, 200, getCachedResponseHeaders(cached, env)), corsHeaders);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshCachedProperties(env, {
      reason: `cron:${controller.cron}`
    }));
  }
};

async function refreshCachedProperties(env, options = {}) {
  const kv = getCacheBinding(env);
  const force = options.force === true;
  const cooldown = await readRefreshCooldown(env);

  if (!force && cooldown) {
    return {
      ok: true,
      refreshed: false,
      reason: 'cooldown',
      cooldown_until: cooldown.until,
      status: 202
    };
  }

  const lock = await readJson(kv, REFRESH_LOCK_KEY);

  if (!force && lock && isFutureIso(lock.until)) {
    return {
      ok: true,
      refreshed: false,
      reason: 'refresh_in_progress',
      locked_until: lock.until,
      status: 202
    };
  }

  await writeJson(kv, REFRESH_LOCK_KEY, {
    until: new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString(),
    reason: options.reason || 'unknown'
  }, {
    expirationTtl: LOCK_TTL_SECONDS
  });

  try {
    const payload = await fetchLodgifyProperties(env);
    const cached = await writeCachedProperties(env, payload, options.reason || 'unknown');
    await kv.delete(COOLDOWN_KEY);

    return {
      ok: true,
      refreshed: true,
      count: payload.count,
      refreshed_at: cached.refreshed_at,
      status: 200
    };
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(error.retryAfter, env);
      const cooldownUntil = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();

      await writeJson(kv, COOLDOWN_KEY, {
        until: cooldownUntil,
        retry_after_seconds: retryAfterSeconds,
        created_at: new Date().toISOString()
      }, {
        expirationTtl: retryAfterSeconds + 60
      });

      logError('lodgify_rate_limited', error, {
        cooldown_until: cooldownUntil
      });

      return {
        ok: true,
        refreshed: false,
        reason: 'rate_limited',
        cooldown_until: cooldownUntil,
        status: 202
      };
    }

    logError('lodgify_refresh_error', error);

    return {
      ok: false,
      refreshed: false,
      reason: 'refresh_failed',
      status: 502
    };
  } finally {
    await kv.delete(REFRESH_LOCK_KEY);
  }
}

async function fetchLodgifyProperties(env) {
  const apiKey = env.LODGIFY_API_KEY;

  if (!apiKey) {
    throw new Error('LODGIFY_API_KEY secret is not configured');
  }

  const websiteId = env.LODGIFY_WEBSITE_ID || DEFAULT_WEBSITE_ID;
  const propertiesUrl = new URL(`${LODGIFY_API_BASE}/properties`);
  propertiesUrl.searchParams.set('wid', websiteId);
  propertiesUrl.searchParams.set('includeCount', 'false');
  propertiesUrl.searchParams.set('includeInOut', 'false');
  propertiesUrl.searchParams.set('page', '1');
  propertiesUrl.searchParams.set('size', '50');

  const data = await fetchJson(propertiesUrl, apiKey);
  const activeListings = Array.isArray(data.items)
    ? data.items.filter((listing) => listing.is_active === true)
    : [];
  const roomFetchDelayMs = getPositiveInt(env.ROOM_FETCH_DELAY_MS, DEFAULT_ROOM_FETCH_DELAY_MS);
  const roomFetchConcurrency = getPositiveInt(env.ROOM_FETCH_CONCURRENCY, DEFAULT_ROOM_FETCH_CONCURRENCY);
  const waitForRoomRequest = createSpacingThrottle(roomFetchDelayMs);

  const items = await mapWithConcurrency(
    activeListings,
    roomFetchConcurrency,
    async (listing) => {
      await waitForRoomRequest();
      const roomDetails = await fetchRoomDetails(listing.id, apiKey);
      return {
        ...listing,
        room_details: roomDetails
      };
    }
  );

  return {
    generated_at: new Date().toISOString(),
    count: items.length,
    items
  };
}

async function fetchRoomDetails(propertyId, apiKey) {
  try {
    const rooms = await fetchJson(`${LODGIFY_API_BASE}/properties/${propertyId}/rooms`, apiKey);
    return Array.isArray(rooms) ? rooms[0] || null : null;
  } catch (error) {
    if (error instanceof UpstreamError && [401, 403, 429].includes(error.status)) {
      throw error;
    }

    console.error(JSON.stringify({
      event: 'lodgify_room_details_error',
      property_id: propertyId,
      message: error instanceof Error ? error.message : 'Unknown error'
    }));
    return null;
  }
}

async function fetchJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'X-ApiKey': apiKey
    }
  });

  if (!response.ok) {
    throw new UpstreamError(response.status, response.headers.get('retry-after'));
  }

  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}

async function readCachedProperties(env) {
  return readJson(getCacheBinding(env), CACHE_KEY);
}

async function writeCachedProperties(env, payload, reason) {
  const cached = {
    payload,
    refreshed_at: new Date().toISOString(),
    refresh_reason: reason
  };

  await writeJson(getCacheBinding(env), CACHE_KEY, cached);
  return cached;
}

async function readRefreshCooldown(env) {
  const cooldown = await readJson(getCacheBinding(env), COOLDOWN_KEY);

  if (!cooldown || !isFutureIso(cooldown.until)) {
    return null;
  }

  return cooldown;
}

async function readJson(kv, key) {
  const value = await kv.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    logError('kv_json_parse_error', error, { key });
    return null;
  }
}

function writeJson(kv, key, value, options) {
  return kv.put(key, JSON.stringify(value), options);
}

function getCacheBinding(env) {
  if (!env.A1A_LODGIFY_CACHE) {
    throw new Error('A1A_LODGIFY_CACHE KV binding is not configured');
  }

  return env.A1A_LODGIFY_CACHE;
}

function getCachedResponseHeaders(cached, env) {
  const ageSeconds = getAgeSeconds(cached.refreshed_at);
  const publicTtl = getPositiveInt(env.PUBLIC_CACHE_TTL_SECONDS, DEFAULT_PUBLIC_CACHE_TTL_SECONDS);
  const staleWhileRevalidate = getPositiveInt(
    env.STALE_WHILE_REVALIDATE_SECONDS,
    DEFAULT_STALE_WHILE_REVALIDATE_SECONDS
  );

  return {
    'cache-control': `public, max-age=${publicTtl}, stale-while-revalidate=${staleWhileRevalidate}`,
    'cdn-cache-control': `max-age=${publicTtl}`,
    'x-a1a-cache': 'kv-hit',
    'x-a1a-cache-age': String(ageSeconds),
    'x-a1a-refreshed-at': cached.refreshed_at
  };
}

function getAgeSeconds(isoDate) {
  const timestamp = Date.parse(isoDate);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
}

function getRetryAfterSeconds(retryAfter, env) {
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.max(seconds, 60);
    }

    const retryAt = Date.parse(retryAfter);

    if (Number.isFinite(retryAt)) {
      return Math.max(60, Math.ceil((retryAt - Date.now()) / 1000));
    }
  }

  return getPositiveInt(env.RATE_LIMIT_COOLDOWN_SECONDS, DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS);
}

function getPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createSpacingThrottle(intervalMs) {
  let nextAllowedAt = 0;

  return async function waitForTurn() {
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);
    nextAllowedAt = Math.max(nextAllowedAt, now) + intervalMs;

    if (waitMs > 0) {
      await delay(waitMs);
    }
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isFutureIso(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

async function isAuthorizedAdminRequest(request, env) {
  const expectedToken = env.ADMIN_REFRESH_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const authorization = request.headers.get('Authorization') || '';
  const actualToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  return constantTimeEqual(actualToken, expectedToken);
}

function constantTimeEqual(actual, expected) {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  const length = Math.max(actualBytes.length, expectedBytes.length);
  let diff = actualBytes.length ^ expectedBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (actualBytes[index] || 0) ^ (expectedBytes[index] || 0);
  }

  return diff === 0;
}

function logError(event, error, details = {}) {
  console.error(JSON.stringify({
    event,
    message: error instanceof Error ? error.message : 'Unknown error',
    status: error instanceof UpstreamError ? error.status : undefined,
    ...details
  }));
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((allowedOrigin) => allowedOrigin.trim())
    .filter(Boolean);
  const headers = {
    vary: 'Origin',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Accept, Content-Type'
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
  }

  return headers;
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}
function withCors(response, corsHeaders) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
