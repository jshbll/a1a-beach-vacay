# Lodgify Worker Proxy

This branch moves Lodgify API access out of the browser and into a cached Cloudflare Worker.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Set the Lodgify API key as a Worker secret. Do not commit the key.

   ```sh
   npx wrangler secret put LODGIFY_API_KEY
   ```

3. Test locally:

   ```sh
   npm run dev
   ```

   Visit `http://localhost:8787/properties`.

4. Deploy:

   ```sh
   npm run deploy
   ```

5. In Webflow, set the proxy endpoint before loading `properties.js`:

   ```html
   <script>
   window.A1A_LODGIFY_PROXY_ENDPOINT = 'https://a1a-lodgify-proxy.<account-subdomain>.workers.dev/properties';
   </script>
   ```

## Notes

- The Worker caches the combined properties and room details response for 300 seconds.
- The browser makes one request to `/properties` instead of one properties request plus one room-detail request per listing.
- The Lodgify API key stays in Cloudflare secrets and is no longer exposed in browser code.
