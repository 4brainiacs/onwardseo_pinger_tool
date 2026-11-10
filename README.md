# onwardseo_pinger_tool

## Deploy and caching
- `main` deploys to production on Netlify (https://tools.onwardseo.com); every pull request gets a Netlify deploy preview.
- Cloudflare sits in front of tools.onwardseo.com. Cache Rules "onwardSEO TOOLS-1" (files under `/assets/`, 1 year) and "onwardSEO TOOLS-2" (`/` and `/index.html`, 1 day) keep successful answers only; `/api/*` is never cached.
- After every production deploy, purge `https://tools.onwardseo.com/` and `https://tools.onwardseo.com/index.html` in Cloudflare (Caching → Configuration → Purge Cache → Custom Purge).
- The ping mechanics (`src/utils/PingController.ts`, `src/utils/pingChecker.ts`, `netlify/functions/`, `lib/types.ts`) change only with a dedicated review.
