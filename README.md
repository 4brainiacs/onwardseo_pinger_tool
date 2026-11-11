# onwardseo_pinger_tool

## Deploy and caching
- `main` deploys to production on Netlify (https://tools.onwardseo.com); every pull request gets a Netlify deploy preview.
- Cloudflare sits in front of tools.onwardseo.com. Cache Rules "onwardSEO TOOLS-1" (files under `/assets/`, 1 year) and "onwardSEO TOOLS-2" (`/` and `/index.html`, 1 day) keep successful answers only; `/api/*` is never cached.
- After every production deploy, purge `https://tools.onwardseo.com/` and `https://tools.onwardseo.com/index.html` in Cloudflare (Caching → Configuration → Purge Cache → Custom Purge).
- The ping mechanics (`src/utils/PingController.ts`, `src/utils/pingChecker.ts`, `netlify/functions/`, including `netlify/functions/lib/types.ts`) change only with a dedicated review.
- AI agent files: `public/llms.txt` is served at `/llms.txt`; `/.well-known/ard.json` and `/.well-known/ai-catalog.json` answer 404 through `public/_redirects` (no ARD manifest, because the tool publishes no agentic resources).
- Releases: pushing a `v*` tag runs `.github/workflows/release.yml`, which builds and publishes the GitHub Release (notes: `CHANGELOG.md`; assets: the files directly in `dist/`).

## Address check
- Before pinging, `/api/ping` opens each address from the server (GET, up to 5 redirects, the canonical address on the same site, 8 s, private networks blocked at connection time) and pings the address the site really uses; see `netlify/functions/lib/urlcheck.ts`.
