const LODGIFY_API_BASE = 'https://api.lodgify.com/v2';
const DEFAULT_WEBSITE_ID = '410037';
const DEFAULT_CACHE_TTL_SECONDS = 300;
const ROOM_FETCH_CONCURRENCY = 8;

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (request.method !== 'GET') {
      return withCors(jsonResponse({ error: 'Method not allowed' }, 405), corsHeaders);
    }

    if (url.pathname === '/health') {
      return withCors(jsonResponse({ ok: true }), corsHeaders);
    }

    if (url.pathname !== '/properties') {
      return withCors(jsonResponse({ error: 'Not found' }, 404), corsHeaders);
    }

    try {
      const cache = caches.default;
      const cacheKey = new Request(new URL('/properties', request.url).toString(), {
        method: 'GET',
        headers: { accept: 'application/json' }
      });
      const cached = await cache.match(cacheKey);

      if (cached) {
        return withCors(cached, corsHeaders);
      }

      const payload = await fetchLodgifyProperties(env);
      const ttl = getCacheTtl(env);
      const response = jsonResponse(payload, 200, {
        'cache-control': `public, max-age=${ttl}`,
        'cdn-cache-control': `max-age=${ttl}`
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return withCors(response, corsHeaders);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'lodgify_proxy_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));

      return withCors(jsonResponse({ error: 'Unable to load properties' }, 502), corsHeaders);
    }
  }
};

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

  const items = await mapWithConcurrency(
    activeListings,
    ROOM_FETCH_CONCURRENCY,
    async (listing) => {
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
    throw new Error(`Lodgify request failed with status ${response.status}`);
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

function getCacheTtl(env) {
  const ttl = Number.parseInt(env.CACHE_TTL_SECONDS || '', 10);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_CACHE_TTL_SECONDS;
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
