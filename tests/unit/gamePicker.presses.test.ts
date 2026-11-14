// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { PICKER_GAMES } from '../../src/ui/picker/pickerModel';

// Phaser also listens for presses on window, so a press on a picker card that sits over a map
// building must not reach window (it would tap that building too). Same fix as PR #73.
describe('game picker press containment', () => {
  it('keeps pointerdown, mousedown and touchstart on a card from reaching window listeners', () => {
    const root = renderGamePicker({ onPick: () => {}, onClose: () => {} });
    document.body.appendChild(root);
    const seen: string[] = [];
    const spy = (e: Event) => seen.push(e.type);
    const types = ['pointerdown', 'mousedown', 'touchstart'];
    for (const t of types) window.addEventListener(t, spy);
    const card = root.querySelector(`[data-testid="${PICKER_GAMES[PICKER_GAMES.length - 1].testId}"]`)!;
    for (const t of types) card.dispatchEvent(new Event(t, { bubbles: true }));
    for (const t of types) window.removeEventListener(t, spy);
    root.remove();
    expect(seen).toEqual([]);
  });
});
