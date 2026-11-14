// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { PICKER_CLOSE_TEST_ID, PICKER_GAMES, WORLD_GAMES } from '../../src/ui/picker/pickerModel';

const PRESS_EVENTS = ['pointerdown', 'mousedown', 'touchstart'] as const;

describe('renderGamePicker press propagation', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
    document.body.innerHTML = '';
  });

  it('stops pointerdown, mousedown, and touchstart from bubbling to window while keeping card click working', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const suitcase = WORLD_GAMES.find((g) => g.gameId === 'travel-suitcase');
    expect(suitcase).toBeDefined();
    const root = renderGamePicker({ onPick, onClose, games: [suitcase!] });
    document.body.appendChild(root);

    const windowPress = vi.fn();
    for (const type of PRESS_EVENTS) {
      const listener = (event: Event) => windowPress(event.type);
      window.addEventListener(type, listener);
      cleanups.push(() => window.removeEventListener(type, listener));
    }

    const suitcaseCard = root.querySelector<HTMLButtonElement>(`[data-testid="${suitcase!.testId}"]`);
    expect(suitcaseCard).not.toBeNull();
    const closeBtn = root.querySelector<HTMLButtonElement>(`[data-testid="${PICKER_CLOSE_TEST_ID}"]`);
    expect(closeBtn).not.toBeNull();

    for (const target of [suitcaseCard!, closeBtn!]) {
      for (const type of PRESS_EVENTS) {
        target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }
    }

    expect(windowPress).not.toHaveBeenCalled();

    suitcaseCard!.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(suitcase);

    closeBtn!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Phaser also listens for presses on window, so a press on a picker card that sits over a map
  // building must not reach window (it would tap that building too). Same fix as PR #73.
  it('keeps pointerdown, mousedown and touchstart on the last Language House card from reaching window listeners', () => {
    const root = renderGamePicker({ onPick: () => {}, onClose: () => {} });
    document.body.appendChild(root);
    const seen: string[] = [];
    const spy = (e: Event) => seen.push(e.type);
    const types = ['pointerdown', 'mousedown', 'touchstart'];
    for (const t of types) window.addEventListener(t, spy);
    const last = PICKER_GAMES[PICKER_GAMES.length - 1];
    const card = root.querySelector(`[data-testid="${last.testId}"]`)!;
    for (const t of types) card.dispatchEvent(new Event(t, { bubbles: true }));
    for (const t of types) window.removeEventListener(t, spy);
    root.remove();
    expect(seen).toEqual([]);
  });
});
