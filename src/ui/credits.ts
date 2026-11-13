import { el } from './dom';
import heStrings from '../content/i18n/he.json';
import type { CreditItem } from '../content/credits';

/** English source strings; the visible Hebrew lives in he.json under `parent`. */
export const CREDITS_EN = {
  title: 'Credits',
  open: 'Credits',
  empty: 'No third-party assets yet',
  back: 'Back',
} as const;

export function renderCredits(root: HTMLElement, items: readonly CreditItem[], onBack: () => void): void {
  const t = heStrings.parent;
  const screen = el('div', 'shell-fullscreen');
  const card = el('div', 'shell-card');
  card.appendChild(el('h2', undefined, t.creditsTitle));
  const body = el('div', 'shell-card-body');
  card.appendChild(body);

  if (items.length === 0) {
    const empty = el('p', 'shell-note', t.creditsEmpty);
    empty.dataset.testid = 'credits-empty';
    body.appendChild(empty);
  } else {
    const list = el('ul');
    list.dataset.testid = 'credits-list';
    for (const item of items) {
      const li = el('li');
      li.appendChild(el('strong', undefined, item.title));
      li.appendChild(el('div', 'shell-note', item.author));
      li.appendChild(el('div', 'shell-note', item.source));
      li.appendChild(el('div', 'shell-note', item.licence));
      li.appendChild(el('div', 'shell-note', item.files.join(', ')));
      list.appendChild(li);
    }
    body.appendChild(list);
  }

  const row = el('div', 'shell-row shell-card-actions');
  const back = el('button', 'shell-btn', t.creditsBack);
  back.dataset.testid = 'credits-back';
  back.addEventListener('click', onBack);
  row.appendChild(back);
  card.appendChild(row);

  screen.appendChild(card);
  root.replaceChildren(screen);
}
