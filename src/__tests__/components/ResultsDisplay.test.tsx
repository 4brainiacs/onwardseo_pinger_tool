import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsDisplay } from '../../components/ResultsDisplay';
import { PING_SERVICES } from '../../services/pingServices';
import type { ApiUrlCheck, PingResults } from '../../types';

const TYPED = 'https://www.example.com';
const PINGED = 'https://example.com/';

function check(verdict: ApiUrlCheck['verdict'], input: string, pingUrl: string, note: string): ApiUrlCheck {
  return { input, pingUrl, finalUrl: pingUrl, canonicalUrl: null, status: 200, verdict, note };
}

function resultsFor(url: string): PingResults {
  return {
    [url]: PING_SERVICES.map(() => ({ url, status: 'success' as const, timestamp: 0 }))
  };
}

function renderResults(results: PingResults, checks?: Record<string, ApiUrlCheck>) {
  render(<ResultsDisplay results={results} selectedServices={new Set()} checks={checks} />);
  const heading = screen.getByRole('heading', { level: 3 });
  const note = heading.nextElementSibling?.tagName === 'P' ? (heading.nextElementSibling as HTMLElement) : null;
  return { heading, note };
}

describe('ResultsDisplay and the address check', () => {
  test.each([
    ['redirected', 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged'],
    ['canonical', 'Corrected from https://www.example.com: the page names https://example.com/ as its main address — that address was pinged']
  ] as const)('%s: the heading is the pinged address, with the gray note under it', (verdict, text) => {
    const { heading, note } = renderResults(resultsFor(PINGED), { [PINGED]: check(verdict, TYPED, PINGED, text) });

    expect(heading).toHaveTextContent(PINGED);
    expect(heading).not.toHaveTextContent('www.example.com');
    expect(note).toHaveTextContent(text);
    expect(note?.className).toBe('text-xs break-all -mt-1.5 mb-2 text-gray-600');
  });

  test.each([
    'Could not check the page (HTTP 403) — pinged as typed',
    'Not corrected: https://www.example.com redirects temporarily to https://example.com/login — pinged as typed'
  ])('unverified: the typed address, with the gray note %j', text => {
    const { heading, note } = renderResults(resultsFor(TYPED), { [TYPED]: check('unverified', TYPED, TYPED, text) });

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toHaveTextContent(text);
    expect(note?.className).toBe('text-xs break-all -mt-1.5 mb-2 text-gray-600');
  });

  test('ok: the address and no note', () => {
    const { heading, note } = renderResults(resultsFor(TYPED), { [TYPED]: check('ok', TYPED, TYPED, '') });

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toBeNull();
  });

  test('no checks (the check could not be done): the address and no note', () => {
    const { heading, note } = renderResults(resultsFor(TYPED));

    expect(heading).toHaveTextContent(TYPED);
    expect(note).toBeNull();
  });

  test('a check for another address is not shown', () => {
    const text = 'Could not check the page (timed out) — pinged as typed';
    const { note } = renderResults(resultsFor(TYPED), { [PINGED]: check('unverified', PINGED, PINGED, text) });

    expect(note).toBeNull();
  });
});
