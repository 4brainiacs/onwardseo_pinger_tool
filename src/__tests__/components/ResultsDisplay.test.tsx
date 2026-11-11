import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsDisplay } from '../../components/ResultsDisplay';
import { PING_SERVICES } from '../../services/pingServices';
import type { ApiUrlCheck, PingResult, PingResults } from '../../types';

const TYPED = 'https://www.example.com';

function check(verdict: ApiUrlCheck['verdict'], pingUrl: string | null, note: string): ApiUrlCheck {
  return { input: TYPED, pingUrl, finalUrl: pingUrl, canonicalUrl: null, status: 200, verdict, note };
}

function resultsWith(status: PingResult['status'], urlCheck?: ApiUrlCheck): PingResults {
  return {
    [TYPED]: PING_SERVICES.map(() => ({ url: TYPED, status, timestamp: 0, check: urlCheck }))
  };
}

function renderResults(results: PingResults) {
  render(<ResultsDisplay results={results} selectedServices={new Set()} />);
  const heading = screen.getByRole('heading', { level: 3 });
  const note = heading.nextElementSibling?.tagName === 'P' ? (heading.nextElementSibling as HTMLElement) : null;
  return { heading, note };
}

describe('ResultsDisplay and the address check', () => {
  test.each([
    ['redirected', 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged'],
    ['canonical', 'Corrected from https://www.example.com: the page names https://example.com/ as its main address — that address was pinged']
  ] as const)('%s: the heading shows the corrected address, with a gray note', (verdict, text) => {
    const { heading, note } = renderResults(resultsWith('success', check(verdict, 'https://example.com/', text)));

    expect(heading).toHaveTextContent('https://example.com/');
    expect(heading).not.toHaveTextContent('www.example.com');
    expect(note).toHaveTextContent(text);
    expect(note).toHaveClass('text-xs', 'break-all', '-mt-1.5', 'mb-2', 'text-gray-600');
    expect(note).not.toHaveClass('text-red-700');
  });

  test.each([
    ['not_found', 'Not pinged: page not found (HTTP 404)'],
    ['unreachable', 'Not pinged: the domain does not exist'],
    ['blocked', 'Not pinged: the address points to a private network']
  ] as const)('%s: the heading shows the typed address, with a red note', (verdict, text) => {
    const { heading, note } = renderResults(resultsWith('error', check(verdict, null, text)));

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toHaveTextContent(text);
    expect(note).toHaveClass('text-xs', 'break-all', '-mt-1.5', 'mb-2', 'text-red-700');
    expect(note).not.toHaveClass('text-gray-600');
  });

  test.each([
    'Could not check the page (HTTP 403) — pinged as typed',
    'Not corrected: https://www.example.com redirects temporarily to https://example.com/login — pinged as typed'
  ])('unverified: the heading shows the typed address, with the gray note %j', text => {
    const { heading, note } = renderResults(resultsWith('success', check('unverified', TYPED, text)));

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toHaveTextContent(text);
    expect(note).toHaveClass('text-gray-600');
  });

  test('ok: the typed address and no note', () => {
    const { heading, note } = renderResults(resultsWith('success', check('ok', TYPED, '')));

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toBeNull();
  });

  test('no check (an answer from before the address check): the typed address and no note', () => {
    const { heading, note } = renderResults(resultsWith('success'));

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toBeNull();
  });

  test('the check is taken from whichever result has it', () => {
    const text = 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged';
    const results = resultsWith('pending');
    results[TYPED][1] = { url: TYPED, status: 'success', timestamp: 0, check: check('redirected', 'https://example.com/', text) };

    const { heading, note } = renderResults(results);

    expect(heading).toHaveTextContent('https://example.com/');
    expect(note).toHaveTextContent(text);
  });
});
