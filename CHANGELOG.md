# Changelog

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

### Changed
- Updated CSP headers to allow embedding from major CMS platforms
- Modified body and root element styles for better iframe integration
- Enhanced responsive design for embedded contexts
- Added important flags to critical iframe styles
- Improved mobile viewport handling
- Updated security headers for broader platform compatibility

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