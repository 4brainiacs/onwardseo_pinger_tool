import type { PingService } from '../types';

export const PING_SERVICES: PingService[] = [
  // Major Search Engines
  {
    name: 'Google Search',
    url: 'https://www.google.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Bing Search',
    url: 'https://www.bing.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Yandex Search',
    url: 'https://blogs.yandex.ru/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Baidu Search',
    url: 'https://ping.baidu.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Blog Services
  {
    name: 'WordPress',
    url: 'https://rpc.wordpress.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Blogger',
    url: 'https://blogger.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Medium',
    url: 'https://medium.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Feed Services
  {
    name: 'Feedburner',
    url: 'https://feedburner.google.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'RSS Feed',
    url: 'https://rpc.rssfeeds.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Social Media
  {
    name: 'Pinterest',
    url: 'https://pinterest.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'LinkedIn',
    url: 'https://linkedin.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Regional Search Engines
  {
    name: 'Naver',
    url: 'https://search.naver.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Yahoo Japan',
    url: 'https://search.yahoo.co.jp/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Qwant',
    url: 'https://www.qwant.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Directory Services
  {
    name: 'DMOZ',
    url: 'https://rpc.dmoz.org/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Webmaster World',
    url: 'https://www.webmasterworld.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // News Services
  {
    name: 'Google News',
    url: 'https://news.google.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Bing News',
    url: 'https://news.bing.com/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Archive Services
  {
    name: 'Internet Archive',
    url: 'https://web.archive.org/ping',
    corsEnabled: true,
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  }
];