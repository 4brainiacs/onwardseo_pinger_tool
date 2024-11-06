import { describe, test, expect, vi } from 'vitest';
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