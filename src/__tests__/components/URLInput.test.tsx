import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { URLInput } from '../../components/URLInput';

describe('URLInput Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly', () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={false}
      />
    );

    expect(screen.getByPlaceholderText(/Enter up to 5 URLs/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toBeInTheDocument();
  });

  test('handles valid URL submission', async () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={false}
      />
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'https://example.com');
    
    const submitButton = screen.getByRole('button', { name: /Start Pinging/i });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(['https://example.com']);
  });

  test('completes addresses typed without a scheme with https://', async () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={false}
      />
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'www.easyskip.uk{Enter}www.prostay.com');
    fireEvent.click(screen.getByRole('button', { name: /Start Pinging/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(['https://www.easyskip.uk', 'https://www.prostay.com']);
  });

  test('submits an address once when it is typed twice', async () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={false}
      />
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'www.example.com{Enter}https://www.example.com');
    fireEvent.click(screen.getByRole('button', { name: /Start Pinging/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(['https://www.example.com']);
  });

  test('while the addresses are checked: "Checking addresses..." and everything disabled', async () => {
    const { rerender } = render(
      <URLInput onSubmit={mockOnSubmit} onReset={mockOnReset} isLoading={false} isCompleted={false} />
    );
    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'https://example.com');

    rerender(
      <URLInput onSubmit={mockOnSubmit} onReset={mockOnReset} isLoading={false} isCompleted={false} isChecking={true} />
    );

    const button = screen.getByRole('button', { name: /Checking addresses\.\.\./ });
    expect(button).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.queryByText(/Start Pinging/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Processing/i)).not.toBeInTheDocument();

    rerender(
      <URLInput onSubmit={mockOnSubmit} onReset={mockOnReset} isLoading={false} isCompleted={false} isChecking={false} />
    );
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toBeEnabled();
    expect(input).toBeEnabled();
  });

  test('the address check\'s message is shown, hidden after an edit, and shown again when a new one arrives', async () => {
    const message = 'Fix before pinging: https://example.com/x — page not found (HTTP 404)';
    const view = (checkError: string) => (
      <URLInput onSubmit={mockOnSubmit} onReset={mockOnReset} isLoading={false} isCompleted={false} checkError={checkError} />
    );
    const { rerender } = render(view(''));
    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'https://example.com/x');
    expect(screen.queryByText(/Fix before pinging/)).not.toBeInTheDocument();

    rerender(view(message));
    const shown = screen.getByText(message);
    // Rendered exactly like the format error line
    expect(shown.parentElement).toHaveClass('flex', 'items-center', 'gap-1', 'text-sm', 'text-red-500');
    expect(shown.parentElement?.querySelector('svg')).not.toBeNull();
    // On a phone the message wraps inside the frame; the icon and the button keep their size
    expect(shown.parentElement).toHaveClass('min-w-0');
    expect(shown).toHaveClass('min-w-0', 'break-words');
    expect(shown.parentElement?.querySelector('svg')).toHaveClass('h-4', 'w-4', 'shrink-0');
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toHaveClass('shrink-0');
    // The button stays usable: the visitor fixes the text and submits again
    expect(screen.getByRole('button', { name: /Start Pinging/i })).toBeEnabled();

    await userEvent.type(input, 'y');
    expect(screen.queryByText(message)).not.toBeInTheDocument();

    // A new submit clears the message and the check brings a new one
    rerender(view(''));
    rerender(view('Fix before pinging: https://example.com/xy — page not found (HTTP 404)'));
    expect(screen.getByText(/Fix before pinging: https:\/\/example\.com\/xy/)).toBeInTheDocument();
  });

  test('a format error keeps priority over the address check\'s message', async () => {
    const message = 'Fix before pinging: https://example.com/x — page not found (HTTP 404)';
    render(
      <URLInput onSubmit={mockOnSubmit} onReset={mockOnReset} isLoading={false} isCompleted={false} checkError={message} />
    );
    expect(screen.getByText(message)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/Enter up to 5 URLs/i), 'invalid-url');

    expect(screen.getByText(/Invalid URL/i)).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  test('shows error for invalid URLs', async () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={false}
      />
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    await userEvent.type(input, 'invalid-url');
    
    const submitButton = screen.getByRole('button', { name: /Start Pinging/i });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Invalid URL/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('handles reset functionality', async () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={false}
        isCompleted={true}
      />
    );

    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);

    expect(mockOnReset).toHaveBeenCalled();
  });

  test('disables input during loading', () => {
    render(
      <URLInput
        onSubmit={mockOnSubmit}
        onReset={mockOnReset}
        isLoading={true}
        isCompleted={false}
      />
    );

    const input = screen.getByPlaceholderText(/Enter up to 5 URLs/i);
    expect(input).toBeDisabled();
    expect(screen.getByText(/Processing/i)).toBeInTheDocument();
  });
});