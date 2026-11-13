import { el } from '../dom';
import heStrings from '../../content/i18n/he.json';
import { PICKER_CLOSE_TEST_ID, PICKER_GAMES, type PickerGame } from './pickerModel';
import { resolvePickerAsset } from './pickerAssets';

export interface GamePickerOptions {
  onPick: (game: PickerGame) => void;
  onClose: () => void;
}

function assetUrl(key: string): string | null {
  const asset = resolvePickerAsset(key);
  return asset.kind === 'css' ? null : `${import.meta.env.BASE_URL}${asset.url}`;
}

function applyArt(node: HTMLElement, key: string): void {
  const asset = resolvePickerAsset(key);
  if (asset.kind === 'css') {
    node.style.cssText += asset.css;
    return;
  }
  const img = el('img', asset.kind === 'manifest' ? 'picker-art-img picker-art-real' : 'picker-art-img');
  img.src = `${import.meta.env.BASE_URL}${asset.url}`;
  img.alt = '';
  img.draggable = false;
  node.appendChild(img);
}

/**
 * Builds the Language House game picker: a full-viewport RTL overlay with one big picture card per game
 * and a big close button. The whole card is the tap target.
 */
export function renderGamePicker(opts: GamePickerOptions): HTMLElement {
  const t = heStrings.gamePicker;
  const root = el('div', 'shell-game-picker');
  root.dir = 'rtl';
  root.lang = 'he';

  const bgUrl = assetUrl('picker-bg');
  if (bgUrl) {
    const bg = el('img', 'picker-backdrop');
    bg.src = bgUrl;
    bg.alt = '';
    bg.draggable = false;
    root.appendChild(bg);
  }
  root.appendChild(el('div', 'picker-scrim'));

  const panel = el('div', 'picker-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'game-picker-title');

  const header = el('div', 'picker-header');
  const close = el('button', 'picker-close');
  close.type = 'button';
  close.dataset.testid = PICKER_CLOSE_TEST_ID;
  close.setAttribute('aria-label', t.close);
  applyArt(close, 'picker-close');
  // The real close.svg (#40) draws its own cross and has no text; the placeholder needs the glyph.
  if (resolvePickerAsset('picker-close').kind === 'manifest') close.classList.add('picker-close-real');
  else close.appendChild(el('span', 'picker-close-x', '×'));
  close.addEventListener('click', () => opts.onClose());
  header.appendChild(close);
  const title = el('h1', 'picker-title', t.title);
  title.id = 'game-picker-title';
  header.appendChild(title);
  panel.appendChild(header);

  const cards = el('div', 'picker-cards');
  for (const game of PICKER_GAMES) {
    const label = t[game.labelKey];
    const card = el('button', 'picker-card');
    card.type = 'button';
    card.dataset.testid = game.testId;
    card.setAttribute('aria-label', label);
    const art = el('div', 'picker-card-art');
    applyArt(art, game.assetKey);
    card.appendChild(art);
    card.appendChild(el('span', 'picker-card-label', label));
    card.addEventListener('click', () => opts.onPick(game));
    cards.appendChild(card);
  }
  panel.appendChild(cards);
  root.appendChild(panel);
  return root;
}
