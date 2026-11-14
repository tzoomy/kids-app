import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { PICKER_CLOSE_TEST_ID, PICKER_GAMES } from '../../src/ui/picker/pickerModel';

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
    const root = renderGamePicker({ onPick, onClose });
    document.body.appendChild(root);

    const windowPress = vi.fn();
    for (const type of PRESS_EVENTS) {
      const listener = (event: Event) => windowPress(event.type);
      window.addEventListener(type, listener);
      cleanups.push(() => window.removeEventListener(type, listener));
    }

    const suitcaseCard = root.querySelector<HTMLButtonElement>('[data-testid="game-picker-travel-suitcase"]');
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
    expect(onPick).toHaveBeenCalledWith(PICKER_GAMES.find((g) => g.gameId === 'travel-suitcase'));

    closeBtn!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
