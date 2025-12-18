import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { PingController } from '../utils/PingController';
import { ErrorProvider } from '../context/ErrorContext';

vi.mock('../utils/PingController');

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(mockStart).toHaveBeenCalledWith(['https://example.com']);
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