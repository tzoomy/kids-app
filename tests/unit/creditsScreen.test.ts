// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderCredits, CREDITS_EN } from '../../src/ui/credits';
import type { CreditItem } from '../../src/content/credits';

const item: CreditItem = {
  title: 'Happy Bear',
  author: 'Jane Doe',
  source: 'https://example.org/happy-bear',
  licence: 'CC-BY',
  files: ['public/art/happy-bear.png', 'public/art/happy-bear-2.png'],
};

describe('renderCredits', () => {
  it('has the exact English source string for the empty line', () => {
    expect(CREDITS_EN.empty).toBe('No third-party assets yet');
  });
  it('shows the empty line and does not throw on []', () => {
    const root = document.createElement('div');
    expect(() => renderCredits(root, [], () => {})).not.toThrow();
    expect(root.querySelector('[data-testid="credits-empty"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="credits-list"]')).toBeNull();
    expect(root.querySelector('[data-testid="credits-back"]')).not.toBeNull();
  });
  it('lists title, author, source, licence and files for an item', () => {
    const root = document.createElement('div');
    renderCredits(root, [item], () => {});
    const list = root.querySelector('[data-testid="credits-list"]')!;
    expect(list).not.toBeNull();
    expect(root.querySelector('[data-testid="credits-empty"]')).toBeNull();
    const text = list.textContent!;
    for (const part of [item.title, item.author, item.source, item.licence, ...item.files]) {
      expect(text).toContain(part);
    }
  });
  it('calls onBack from the back button', () => {
    const root = document.createElement('div');
    const onBack = vi.fn();
    renderCredits(root, [], onBack);
    (root.querySelector('[data-testid="credits-back"]') as HTMLElement).click();
    expect(onBack).toHaveBeenCalledOnce();
  });
});
