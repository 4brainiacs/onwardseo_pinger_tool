# Changelog

## [1.5.0] - 2026-11-11

### Added
- Each address is checked before it is pinged and corrected to the address the site really uses. The tool follows up to 5 redirects: a permanent redirect (301 or 308), or a temporary one whose destination names itself as the main address, corrects the address; it also reads the page's canonical address (same site only, and only if it answers). `https://www.example.com` that redirects to `https://example.com/` is pinged as `https://example.com/`, and the result shows the corrected address and why. Addresses whose domain does not exist, whose page answers 404 or 410, or that lead to a private network are not pinged. When the page cannot be checked (for example HTTP 403 from bot protection, a timeout or a non-standard port), it is pinged as typed and the result says so.

### Fixed
- Addresses typed without `http://` or `https://` (for example `www.example.com`) are pinged as `https://www.example.com`. Before, the ping API rejected them ("Invalid URL format") and every service showed "error". The form had accepted such addresses since the real ping API was added (December 2025).
- An address typed twice in one run is pinged once.

### Unchanged
- The ping services, their timeouts and retries, and the order and pace of the pings.

## [1.4.1] - 2026-11-10

### Agent discoverability
- `/llms.txt` is a short Markdown description of the tool for AI agents (title, summary and links), in the format of https://llmstxt.org/. Before, it answered with the app page.
- `/.well-known/ard.json` and `/.well-known/ai-catalog.json` answer 404: the tool publishes no agentic resources (no MCP server, agent or skill), so it has no ARD manifest. Before, both answered with the app page.

### Release workflow
- The release job may now write repository contents (`permissions: contents: write`), so pushing a `v*` tag publishes its GitHub Release. The v1.4.0 run failed with HTTP 403 for lack of this permission; that release was published by hand.

### Unchanged
- How the tool pings. Every other URL answers as before.

## [1.4.0] - 2026-11-10

### Performance
- The tool's first screen is pre-built into `index.html` at build time and hydrated in the browser, so the form is visible before the JavaScript bundle has loaded; text typed before that is kept (#8).
- A request for a missing file under `/assets/` answers 404 instead of the app page (#9).
- Production caching (Cloudflare, outside this repository): `/` and `/index.html` are kept for 1 day and the hashed files under `/assets/` for 1 year, successful answers only. After every production deploy, purge `https://tools.onwardseo.com/` and `https://tools.onwardseo.com/index.html`.

### Accessibility
- The page has a `main` landmark.
- The category and service toggle buttons use `aria-pressed` (`true`, `false`, or `mixed` for a partly selected category) instead of `aria-checked`.
- The viewport no longer blocks zooming.
- Count labels and the "pending" status use `text-gray-500` and the "success" status uses `text-green-700`, for sufficient contrast.

### Tests and CI
- CI on main is green again; new tests pin the current ping sequence: one `/api/ping` request per URL, 500 ms between services, pause, resume and stop (#6).

### Unchanged
- How the tool pings.

## [1.2.28] - 2024-11-06

### Added
- Enhanced iframe embedding support for WordPress and other platforms
- Fixed iframe scrolling issues on mobile devices
- Added forced iframe styles to prevent theme interference
- Improved iframe height calculations for different screen sizes
- Added touch device optimizations for embedded iframes
- Added comprehensive security headers for iframe embedding
- Extended frame-ancestors directive to support major CMS platforms
- Added X-Frame-Options with ALLOW-FROM for multiple platforms
- Added unit tests for core components and utilities
- Added test coverage reporting
- Added Vitest UI for interactive testing

### Changed
- Updated CSP headers to allow embedding from major CMS platforms
- Modified body and root element styles for better iframe integration
- Enhanced responsive design for embedded contexts
- Added important flags to critical iframe styles
- Improved mobile viewport handling
- Updated security headers for broader platform compatibility
- Enhanced test infrastructure with Jest DOM matchers
- Improved test coverage for URL validation and components

### Security
- Implemented proper Content Security Policy for iframes
- Added secure frame-ancestors directives
- Updated X-Frame-Options for multiple trusted domains
- Enhanced Referrer-Policy settings
- Improved cross-origin resource sharing configuration

## [1.2.27] - 2024-11-06

### Fixed
- Improved TypeScript type definitions in ping service
- Added retryable property to PingResponse type
- Fixed type-only imports in ErrorContext components
- Enhanced error severity type handling
- Optimized context provider type definitions

[Previous changelog entries...]