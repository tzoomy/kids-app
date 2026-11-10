import { el } from './dom';
import { formatClock } from './dom';
import type { ProfileSettings, ProfileState } from '../core/storage/schema';
import heStrings from '../content/i18n/he.json';

export interface ProfileSelectEntry {
  profile: ProfileSettings;
  state: ProfileState;
}

const AVATAR_EMOJI: Record<string, string> = {
  bunny: '🦄',
  butterfly: '🦋',
};

export function renderProfileSelect(
  root: HTMLElement,
  entries: ProfileSelectEntry[],
  onPick: (profileId: string) => void,
  onParent: () => void,
): void {
  const screen = el('div', 'shell-fullscreen');
  screen.appendChild(el('h1', 'shell-title', heStrings.appTitle));
  screen.appendChild(el('div', 'shell-title', heStrings.whoIsPlaying));

  const row = el('div', 'shell-row');
  for (const { profile, state } of entries) {
    const btn = el('button', 'shell-btn shell-profile-btn');
    btn.dataset.testid = `profile-${profile.id}`;
    const avatar = el('div', 'shell-avatar', AVATAR_EMOJI[profile.avatar] ?? '⭐');
    avatar.style.fontSize = 'clamp(40px, 10vmin, 90px)';
    avatar.style.background = '#fff';
    btn.appendChild(avatar);
    btn.appendChild(el('span', undefined, profile.name));
    btn.appendChild(el('span', undefined, `⏳ ${formatClock(state.balanceSec)}`));
    btn.addEventListener('click', () => onPick(profile.id));
    row.appendChild(btn);
  }
  screen.appendChild(row);

  const parentBtn = el('button', 'shell-pill', `🔒 ${heStrings.parentArea}`);
  parentBtn.dataset.testid = 'parent-gate-btn';
  parentBtn.style.position = 'absolute';
  parentBtn.style.insetInlineStart = 'max(2vmin, env(safe-area-inset-left))';
  parentBtn.style.bottom = 'max(2vmin, env(safe-area-inset-bottom))';
  parentBtn.addEventListener('click', onParent);
  screen.appendChild(parentBtn);

  root.replaceChildren(screen);
}
