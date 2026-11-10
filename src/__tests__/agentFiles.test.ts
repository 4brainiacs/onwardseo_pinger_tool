import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';

const publicFile = (name: string) => readFileSync(join(process.cwd(), 'public', name), 'utf8');

describe('public/llms.txt', () => {
  const body = publicFile('llms.txt');

  // The three checks of Lighthouse 13.6.0's llms-txt audit
  test('has a Markdown H1 line', () => {
    expect(body).toMatch(/^\s*#\s+.+/m);
  });

  test('has a Markdown link', () => {
    expect(body).toMatch(/\[.+\]\(.+\)/);
  });

  test('has at least 50 characters', () => {
    expect(body.length).toBeGreaterThanOrEqual(50);
  });
});

describe('public/_redirects', () => {
  const rules = publicFile('_redirects')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'))
    .map(line => {
      const [from, to, status] = line.split(/\s+/);
      return { from, to, status };
    });
  const indexOfRule = (from: string) => rules.findIndex(rule => rule.from === from);

  test('has the catch-all rule', () => {
    expect(indexOfRule('/*')).toBeGreaterThanOrEqual(0);
  });

  test.each(['/.well-known/ard.json', '/.well-known/ai-catalog.json'])(
    '%s answers 404 and comes before the catch-all',
    from => {
      const index = indexOfRule(from);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(rules[index].status).toBe('404');
      expect(index).toBeLessThan(indexOfRule('/*'));
    }
  );
});
