import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { PingController } from '../utils/PingController';
import { ErrorProvider } from '../context/ErrorContext';
import { PING_SERVICES } from '../services/pingServices';
import { checkAddresses } from '../utils/addressCheck';
import type { ApiUrlCheck, PingResults } from '../types';

vi.mock('../utils/PingController');
vi.mock('../utils/addressCheck', () => ({ checkAddresses: vi.fn() }));

const ALL_SERVICES = new Set(PING_SERVICES.map(service => service.name));

/**
 * A PingController whose start() reports every URL as pinged successfully.
 */
function installController() {
  const start = vi.fn();
  (PingController as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_onProgress: unknown, onResults: (results: PingResults) => void) => {
      start.mockImplementation(async (urls: string[]) => {
        const results: PingResults = {};
        for (const url of urls) {
          results[url] = PING_SERVICES.map(() => ({ url, status: 'success' as const, timestamp: 0 }));
        }
        onResults(results);
      });
      return { start, stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), reset: vi.fn() };
    }
  );
  return start;
}

async function submit(text: string) {
  render(
    <ErrorProvider>
      <App />
    </ErrorProvider>
  );
  await userEvent.type(screen.getByPlaceholderText(/Enter up to 5 URLs/i), text);
  fireEvent.click(screen.getByRole('button', { name: /Start Pinging/i }));
}

describe('App: the address check before pinging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('an address whose page is not found: the red message, and nothing is pinged', async () => {
    const start = installController();
    const notFound: ApiUrlCheck = {
      input: 'https://example.com/x',
      pingUrl: null,
      finalUrl: 'https://example.com/x',
      canonicalUrl: null,
      status: 404,
      verdict: 'not_found',
      note: 'Not pinged: page not found (HTTP 404)'
    };
    vi.mocked(checkAddresses).mockResolvedValue([notFound]);

    await submit('https://example.com/x');

    const message = await screen.findByText('Fix before pinging: https://example.com/x — page not found (HTTP 404)');
    expect(message.parentElement).toHaveClass('text-red-500');
    expect(checkAddresses).toHaveBeenCalledWith(['https://example.com/x']);
    expect(PingController).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    // The loading state ended as if nothing started
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toBeEnabled();
    expect(screen.getByPlaceholderText(/Enter up to 5 URLs/i)).toBeEnabled();
    expect(screen.queryByText('Ping Results')).not.toBeInTheDocument();
    expect(screen.queryByText(/Could not check the addresses/)).not.toBeInTheDocument();
  });

  test('one address that cannot be pinged stops the whole run, and only it is named', async () => {
    const start = installController();
    vi.mocked(checkAddresses).mockResolvedValue([
      { input: 'https://www.example.com', pingUrl: 'https://example.com/', finalUrl: 'https://example.com/', canonicalUrl: null, status: 200, verdict: 'redirected', note: 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged' },
      { input: 'https://nowhere.example', pingUrl: null, finalUrl: null, canonicalUrl: null, status: null, verdict: 'unreachable', note: 'Not pinged: the domain does not exist' },
      { input: 'http://internal.example', pingUrl: null, finalUrl: null, canonicalUrl: null, status: null, verdict: 'blocked', note: 'Not pinged: the address points to a private network' }
    ]);

    await submit('www.example.com{Enter}nowhere.example{Enter}http://internal.example');

    expect(await screen.findByText(
      'Fix before pinging: https://nowhere.example — the domain does not exist; http://internal.example — the address points to a private network'
    )).toBeInTheDocument();
    expect(checkAddresses).toHaveBeenCalledWith(['https://www.example.com', 'https://nowhere.example', 'http://internal.example']);
    expect(start).not.toHaveBeenCalled();
  });

  test('a redirected address: the corrected address is pinged, with the gray note under its heading', async () => {
    const start = installController();
    const note = 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged';
    vi.mocked(checkAddresses).mockResolvedValue([
      { input: 'https://www.example.com', pingUrl: 'https://example.com/', finalUrl: 'https://example.com/', canonicalUrl: null, status: 200, verdict: 'redirected', note }
    ]);

    await submit('www.example.com');

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(['https://example.com/'], ALL_SERVICES);
    });
    const heading = await screen.findByRole('heading', { level: 3, name: 'https://example.com/' });
    const shownNote = heading.nextElementSibling as HTMLElement;
    expect(shownNote).toHaveTextContent(note);
    expect(shownNote.className).toBe('text-xs break-all -mt-1.5 mb-2 text-gray-600');
    expect(screen.queryByText(/Fix before pinging/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Could not check the addresses/)).not.toBeInTheDocument();
  });

  test('the check could not be done: the typed addresses are pinged, and the notice is shown', async () => {
    const start = installController();
    vi.mocked(checkAddresses).mockResolvedValue(null);

    await submit('www.example.com{Enter}https://example.org/page');

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(['https://www.example.com', 'https://example.org/page'], ALL_SERVICES);
    });
    const notice = await screen.findByText('Could not check the addresses — pinged as typed');
    expect(notice.tagName).toBe('P');
    expect(notice.className).toBe('w-full max-w-4xl text-xs text-gray-600');
    // Directly above "Ping Results"
    expect(notice.nextElementSibling).toContainElement(screen.getByText('Ping Results'));
    expect(screen.queryByText(/Fix before pinging/)).not.toBeInTheDocument();
  });

  test('two addresses that correct to the same address are pinged once', async () => {
    const start = installController();
    vi.mocked(checkAddresses).mockResolvedValue([
      { input: 'https://www.example.com', pingUrl: 'https://example.com/', finalUrl: 'https://example.com/', canonicalUrl: null, status: 200, verdict: 'redirected', note: 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged' },
      { input: 'http://example.com', pingUrl: 'https://example.com/', finalUrl: 'https://example.com/', canonicalUrl: null, status: 200, verdict: 'redirected', note: 'Corrected from http://example.com: it redirects to https://example.com/ — that address was pinged' }
    ]);

    await submit('www.example.com{Enter}http://example.com');

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(['https://example.com/'], ALL_SERVICES);
    });
    expect(start).toHaveBeenCalledTimes(1);
    // The note of the first address that led there is shown
    expect(await screen.findByText(/Corrected from https:\/\/www\.example\.com:/)).toBeInTheDocument();
    expect(screen.queryByText(/Corrected from http:\/\/example\.com:/)).not.toBeInTheDocument();
  });

  test('while the check runs, the button says "Checking addresses..." and nothing is pinged yet', async () => {
    const start = installController();
    let finish: (checks: ApiUrlCheck[] | null) => void = () => {};
    vi.mocked(checkAddresses).mockReturnValue(new Promise(resolve => {
      finish = resolve;
    }));

    await submit('https://example.com');

    const button = await screen.findByRole('button', { name: /Checking addresses\.\.\./ });
    expect(button).toBeDisabled();
    expect(screen.getByPlaceholderText(/Enter up to 5 URLs/i)).toBeDisabled();
    expect(start).not.toHaveBeenCalled();

    finish([{ input: 'https://example.com', pingUrl: 'https://example.com', finalUrl: 'https://example.com/', canonicalUrl: null, status: 200, verdict: 'ok', note: '' }]);

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(['https://example.com'], ALL_SERVICES);
    });
  });

  test('a new submit clears the message of the previous one', async () => {
    const start = installController();
    vi.mocked(checkAddresses).mockResolvedValueOnce([
      { input: 'https://example.com/x', pingUrl: null, finalUrl: 'https://example.com/x', canonicalUrl: null, status: 404, verdict: 'not_found', note: 'Not pinged: page not found (HTTP 404)' }
    ]);
    vi.mocked(checkAddresses).mockResolvedValueOnce([
      { input: 'https://example.com/x', pingUrl: 'https://example.com/x', finalUrl: 'https://example.com/x', canonicalUrl: null, status: 200, verdict: 'ok', note: '' }
    ]);

    await submit('https://example.com/x');
    await screen.findByText(/Fix before pinging/);

    fireEvent.click(screen.getByRole('button', { name: /Start Pinging/i }));

    await waitFor(() => {
      expect(start).toHaveBeenCalledWith(['https://example.com/x'], ALL_SERVICES);
    });
    expect(screen.queryByText(/Fix before pinging/)).not.toBeInTheDocument();
  });
});

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The address check is not part of these tests: it "could not be done", as in dev mode
    vi.mocked(checkAddresses).mockResolvedValue(null);
  });

  test('renders main components', () => {
    render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );
    
    expect(screen.getByText(/Ping Website URLs & Backlinks/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter up to 5 URLs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toBeInTheDocument();
  });

  test('renders exactly one main landmark', () => {
    const { container } = render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );

    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  test('validates URL input', async () => {
    render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );
    
    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    const submitButton = screen.getByRole('button', { name: /Start Pinging/i });

    // Invalid URL
    await userEvent.type(input, 'invalid-url');
    fireEvent.submit(submitButton);
    
    expect(screen.getByText(/Invalid URL/i)).toBeInTheDocument();

    // Too many URLs
    await userEvent.clear(input);
    await userEvent.type(input, `
      https://example1.com
      https://example2.com
      https://example3.com
      https://example4.com
      https://example5.com
      https://example6.com
    `);
    
    expect(screen.getByText(/Maximum 5 URLs allowed/i)).toBeInTheDocument();
  });

  test('handles successful ping operation', async () => {
    const mockStart = vi.fn().mockResolvedValue(undefined);
    (PingController as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      start: mockStart,
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    }));

    render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'https://example.com');
    
    const submitButton = screen.getByRole('button', { name: /Start Pinging/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // App passes the URLs and the selected services (all of them by default)
      expect(mockStart).toHaveBeenCalledWith(
        ['https://example.com'],
        new Set(PING_SERVICES.map(service => service.name))
      );
    });
  });

  test('handles error states', async () => {
    const mockStart = vi.fn().mockRejectedValue(new Error('Network error'));
    (PingController as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      start: mockStart,
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn()
    }));

    render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'https://example.com');
    
    const submitButton = screen.getByRole('button', { name: /Start Pinging/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  test('category filter functionality', async () => {
    render(
      <ErrorProvider>
        <App />
      </ErrorProvider>
    );

    // All Categories button should be present
    const allCategoriesButton = screen.getByRole('button', { name: /All Categories/i });
    expect(allCategoriesButton).toBeInTheDocument();

    // Search Engines category should be present
    const searchEnginesButton = screen.getByRole('button', { name: /Search Engines/i });
    expect(searchEnginesButton).toBeInTheDocument();

    // Blog Networks category should be present
    const blogNetworksButton = screen.getByRole('button', { name: /Blog Networks/i });
    expect(blogNetworksButton).toBeInTheDocument();

    // Individual services should be present
    expect(screen.getByRole('button', { name: /Google PubSubHubbub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ping-o-Matic/i })).toBeInTheDocument();

    // Click to toggle a category
    fireEvent.click(searchEnginesButton);
    // After clicking, should toggle the category state
  });
});