# Lodgify Worker Proxy

This branch moves Lodgify API access out of the browser and into a Cloudflare Worker backed by Workers KV.

The public `/properties` endpoint only reads the latest cached JSON from KV. Lodgify refreshes happen from a Cloudflare Cron Trigger every 30 minutes, or from the guarded manual refresh endpoint. This prevents site traffic from stampeding the Lodgify API.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Set the Lodgify API key as a Worker secret. Do not commit the key.

   ```sh
   npx wrangler secret put LODGIFY_API_KEY
   ```

3. Optional: set an admin refresh token for manual cache warming.

   ```sh
   npx wrangler secret put ADMIN_REFRESH_TOKEN
   ```

4. Create the KV namespace, then add its ID to `wrangler.jsonc`.

   ```sh
   npx wrangler kv namespace create A1A_LODGIFY_CACHE
   ```

5. Test locally:

   ```sh
   npm run dev -- --test-scheduled
   ```

   Visit `http://localhost:8787/health`.

6. Deploy:

   ```sh
   npm run deploy
   ```

7. If `ADMIN_REFRESH_TOKEN` is configured, warm the cache manually:

   ```sh
   curl -X POST \
     -H "Authorization: Bearer $ADMIN_REFRESH_TOKEN" \
     https://a1a-lodgify-proxy.joshuacball-d12.workers.dev/admin/refresh
   ```

8. In Webflow, set the proxy endpoint before loading `properties.js`:

   ```html
   <script>
   window.A1A_LODGIFY_PROXY_ENDPOINT = 'https://a1a-lodgify-proxy.joshuacball-d12.workers.dev/properties';
   </script>
   ```

## Notes

- The Worker stores the combined properties and room details response in Workers KV.
- Public traffic never refreshes Lodgify directly. If the cache is empty, `/properties` returns `503` until cron or manual refresh populates KV.
- If Lodgify returns `429`, the Worker records a cooldown in KV and keeps serving the last successful cached response.
- Room-detail calls are intentionally conservative: one request at a time with a 300ms spacing delay by default.
- The browser makes one request to `/properties` instead of one properties request plus one room-detail request per listing.
- The Lodgify API key stays in Cloudflare secrets and is no longer exposed in browser code.
