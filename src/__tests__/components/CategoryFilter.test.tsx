import { useState } from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryFilter } from '../../components/CategoryFilter';
import { PING_SERVICES, getServicesByCategory } from '../../services/pingServices';
import type { CategoryType } from '../../types';

const CATEGORIES: CategoryType[] = ['Search Engines', 'Blog Networks'];
const ALL_NAMES = PING_SERVICES.map(service => service.name);

function Harness({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(new Set(initial));
  return <CategoryFilter selectedServices={selected} onServiceChange={setSelected} />;
}

/** The state the button shows: its icon is a checked, a minus or an empty square. */
function visibleState(button: HTMLElement): 'true' | 'false' | 'mixed' {
  const icon = button.querySelector('svg');
  if (!icon) throw new Error(`no icon in button "${button.textContent}"`);
  const iconClass = icon.getAttribute('class') ?? '';
  if (iconClass.includes('check')) return 'true';
  if (iconClass.includes('minus')) return 'mixed';
  return 'false';
}

function expectEveryToggleToMatch() {
  const buttons = screen.getAllByRole('button');
  // 1 "All Categories" + the categories + the services
  expect(buttons).toHaveLength(1 + CATEGORIES.length + PING_SERVICES.length);
  for (const button of buttons) {
    expect(button).not.toHaveAttribute('aria-checked');
    expect(button).toHaveAttribute('aria-pressed', visibleState(button));
  }
}

function pressedOf(name: RegExp) {
  return screen.getByRole('button', { name }).getAttribute('aria-pressed');
}

describe('CategoryFilter toggle buttons', () => {
  test('all selected: every button is pressed', () => {
    render(<Harness initial={ALL_NAMES} />);

    expectEveryToggleToMatch();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('none selected: no button is pressed', () => {
    render(<Harness initial={[]} />);

    expectEveryToggleToMatch();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('one service selected: its category and "All Categories" are mixed or pressed as shown', () => {
    const service = PING_SERVICES[0];
    const sameCategory = getServicesByCategory(service.category);
    render(<Harness initial={[service.name]} />);

    expectEveryToggleToMatch();
    expect(pressedOf(/All Categories/i)).toBe('mixed');
    expect(pressedOf(new RegExp(`^${service.category}`))).toBe(sameCategory.length === 1 ? 'true' : 'mixed');
    for (const category of CATEGORIES.filter(c => c !== service.category)) {
      expect(pressedOf(new RegExp(`^${category}`))).toBe('false');
    }
  });

  test('a partly selected category is mixed', () => {
    const category = CATEGORIES.find(c => getServicesByCategory(c).length > 1);
    if (!category) throw new Error('no category with more than one service');
    const [first] = getServicesByCategory(category);
    render(<Harness initial={[first.name]} />);

    expectEveryToggleToMatch();
    expect(pressedOf(new RegExp(`^${category}`))).toBe('mixed');
    expect(pressedOf(/All Categories/i)).toBe('mixed');
    expect(pressedOf(new RegExp(first.name))).toBe('true');
  });

  test('aria-pressed follows the visible state after every click', () => {
    render(<Harness initial={ALL_NAMES} />);

    // Unselect one service, then a whole category, then everything, then select everything again
    fireEvent.click(screen.getByRole('button', { name: new RegExp(PING_SERVICES[0].name) }));
    expectEveryToggleToMatch();
    expect(pressedOf(/All Categories/i)).toBe('mixed');

    fireEvent.click(screen.getByRole('button', { name: /^Blog Networks/ }));
    expectEveryToggleToMatch();

    fireEvent.click(screen.getByRole('button', { name: /^Search Engines/ }));
    expectEveryToggleToMatch();

    fireEvent.click(screen.getByRole('button', { name: /All Categories/i }));
    expectEveryToggleToMatch();

    fireEvent.click(screen.getByRole('button', { name: /All Categories/i }));
    expectEveryToggleToMatch();
  });
});
