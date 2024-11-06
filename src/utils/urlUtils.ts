import { logger } from './logger';

const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/\S*)?$/;
const MAX_URL_LENGTH = 2048;
const RESTRICTED_CHARS = /[<>"{}|\\^`]/;
const VALID_PROTOCOLS = ['http:', 'https:'];

export interface URLValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedUrl?: string;
}

export function validateUrl(url: string): URLValidationResult {
  const errors: string[] = [];

  // Basic checks
  if (!url || typeof url !== 'string') {
    return { isValid: false, errors: ['URL must be a non-empty string'] };
  }

  const trimmedUrl = url.trim();

  // Length check
  if (trimmedUrl.length > MAX_URL_LENGTH) {
    errors.push(`URL exceeds maximum length of ${MAX_URL_LENGTH} characters`);
  }

  // Check for restricted characters
  if (RESTRICTED_CHARS.test(trimmedUrl)) {
    errors.push('URL contains invalid characters');
  }

  try {
    // Add protocol if missing
    let urlWithProtocol = trimmedUrl;
    if (!trimmedUrl.match(/^[a-z]+:\/\//i)) {
      urlWithProtocol = 'https://' + trimmedUrl;
    }

    const urlObject = new URL(urlWithProtocol);

    // Protocol validation
    if (!VALID_PROTOCOLS.includes(urlObject.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }

    // Domain validation
    const domain = urlObject.hostname;
    const domainParts = domain.split('.');

    if (domainParts.length < 2) {
      errors.push('Invalid domain format');
    }

    // Validate each domain part
    for (const part of domainParts) {
      if (!part || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(part)) {
        errors.push('Invalid domain name format');
        break;
      }
      if (part.length > 63) {
        errors.push('Domain part exceeds maximum length');
        break;
      }
    }

    // TLD validation
    const tld = domainParts[domainParts.length - 1];
    if (tld && tld.length < 2) {
      errors.push('Invalid top-level domain');
    }

    if (errors.length === 0) {
      const normalizedUrl = normalizeUrl(urlWithProtocol);
      return { isValid: true, errors: [], normalizedUrl };
    }
  } catch (error) {
    logger.debug('URL validation error', {
      url: trimmedUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    errors.push('Invalid URL format');
  }

  return { isValid: false, errors };
}

export function normalizeUrl(url: string): string {
  try {
    let normalizedUrl = url.trim().toLowerCase();
    
    if (!normalizedUrl.match(/^[a-z]+:\/\//)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    const urlObject = new URL(normalizedUrl);
    
    // Clean up hostname
    let hostname = urlObject.hostname
      .replace(/^www\./, '')
      .replace(/\.+/g, '.')
      .replace(/\.$/, '');
    
    urlObject.hostname = hostname;
    
    // Remove default ports
    if ((urlObject.protocol === 'http:' && urlObject.port === '80') ||
        (urlObject.protocol === 'https:' && urlObject.port === '443')) {
      urlObject.port = '';
    }
    
    // Remove trailing slashes
    let finalUrl = urlObject.toString();
    return finalUrl.replace(/\/+$/, '');
  } catch (error) {
    throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function extractDomain(url: string): string {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObject = new URL(normalizedUrl);
    return urlObject.hostname.replace(/^www\./i, '');
  } catch {
    throw new Error('Invalid URL: Cannot extract domain');
  }
}