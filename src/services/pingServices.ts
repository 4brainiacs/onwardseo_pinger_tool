import type { PingService } from '../types';

export const PING_SERVICES: PingService[] = [
  // Major Search Engines
  {
    name: 'Google Search',
    url: 'https://www.google.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Bing Search',
    url: 'https://www.bing.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Yandex Search',
    url: 'https://blogs.yandex.ru/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Baidu Search',
    url: 'https://ping.baidu.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Blog Services
  {
    name: 'WordPress',
    url: 'https://rpc.wordpress.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Blogger',
    url: 'https://blogger.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Medium',
    url: 'https://medium.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Feed Services
  {
    name: 'Feedburner',
    url: 'https://feedburner.google.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'RSS Feed',
    url: 'https://rpc.rssfeeds.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Social Media
  {
    name: 'Pinterest',
    url: 'https://pinterest.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'LinkedIn',
    url: 'https://linkedin.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Regional Search Engines
  {
    name: 'Naver',
    url: 'https://search.naver.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Yahoo Japan',
    url: 'https://search.yahoo.co.jp/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Qwant',
    url: 'https://www.qwant.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Directory Services
  {
    name: 'DMOZ',
    url: 'https://rpc.dmoz.org/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Webmaster World',
    url: 'https://www.webmasterworld.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // News Services
  {
    name: 'Google News',
    url: 'https://news.google.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  {
    name: 'Bing News',
    url: 'https://news.bing.com/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  },
  // Archive Services
  {
    name: 'Internet Archive',
    url: 'https://web.archive.org/ping',
    method: 'GET',
    requiresProxy: false,
    proxyUrl: ''
  }
];