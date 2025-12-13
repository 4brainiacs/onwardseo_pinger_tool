/**
 * Real Ping Services Configuration
 *
 * These services are actually pinged by the backend via:
 * - WebSub/PubSubHubbub protocol (for Google)
 * - XML-RPC weblogUpdates.ping protocol (for blog ping services)
 *
 * Each service reaches multiple downstream search engines and aggregators.
 */

import type { PingService } from '../types';

/**
 * List of real ping services
 *
 * Total reach: 15+ search engines and services
 */
export const PING_SERVICES: PingService[] = [
  {
    name: 'Google PubSubHubbub',
    method: 'websub',
    category: 'Search Engines',
    description: 'Notifies Google via PubSubHubbub protocol',
    reachesServices: ['Google Search', 'Google News']
  },
  {
    name: 'Ping-o-Matic',
    method: 'xmlrpc',
    category: 'Blog Networks',
    description: 'Pings 10+ blog aggregators and services',
    reachesServices: [
      'Feedburner',
      'Superfeedr',
      'Spinn3r',
      'Blo.gs',
      'Moreover',
      'Syndic8',
      'NewsGator',
      'Audio.weblogs.com'
    ]
  },
  {
    name: 'Yandex Blogs',
    method: 'xmlrpc',
    category: 'Search Engines',
    description: 'Notifies Yandex blog search',
    reachesServices: ['Yandex Search', 'Yandex Blogs']
  },
  {
    name: 'Twingly',
    method: 'xmlrpc',
    category: 'Blog Networks',
    description: 'Swedish blog search and aggregator',
    reachesServices: ['Twingly Blog Search']
  },
  {
    name: 'Weblogs.com',
    method: 'xmlrpc',
    category: 'Blog Networks',
    description: 'Original blog ping service by Dave Winer',
    reachesServices: ['Weblogs.com', 'Blog directories']
  }
];

/**
 * Get service by name
 */
export function getServiceByName(name: string): PingService | undefined {
  return PING_SERVICES.find(s => s.name === name);
}

/**
 * Get services by category
 */
export function getServicesByCategory(category: string): PingService[] {
  return PING_SERVICES.filter(s => s.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  return [...new Set(PING_SERVICES.map(s => s.category))];
}

/**
 * Get total count of downstream services reached
 */
export function getTotalReach(): number {
  const allServices = PING_SERVICES.flatMap(s => s.reachesServices);
  return new Set(allServices).size;
}
