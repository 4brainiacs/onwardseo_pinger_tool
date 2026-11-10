# Changelog

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