import { el } from './dom';
import { formatClock } from './dom';
import type { ProfileSettings, ProfileState } from '../core/storage/schema';
import heStrings from '../content/i18n/he.json';
import { attachLongPress } from './longPress';

export interface ProfileSelectEntry {
  profile: ProfileSettings;
  state: ProfileState;
  /** False while time earning is paused: no balance chip. Defaults to true. */
  showTime?: boolean;
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
  /** A 3-second hold of the parent button opens the settings directly. Without it the button only taps. */
  onParentLongPress?: () => void,
): void {
  const screen = el('div', 'shell-fullscreen');
  screen.appendChild(el('h1', 'shell-title', heStrings.appTitle));
  screen.appendChild(el('div', 'shell-title', heStrings.whoIsPlaying));

  const row = el('div', 'shell-row');
  for (const { profile, state, showTime } of entries) {
    const btn = el('button', 'shell-btn shell-profile-btn');
    btn.dataset.testid = `profile-${profile.id}`;
    const avatar = el('div', 'shell-avatar', AVATAR_EMOJI[profile.avatar] ?? '⭐');
    avatar.style.fontSize = 'clamp(40px, 10vmin, 90px)';
    avatar.style.background = '#fff';
    btn.appendChild(avatar);
    btn.appendChild(el('span', undefined, profile.name));
    if (showTime !== false) btn.appendChild(el('span', undefined, `⏳ ${formatClock(state.balanceSec)}`));
    btn.addEventListener('click', () => onPick(profile.id));
    row.appendChild(btn);
  }
  screen.appendChild(row);

  const parentBtn = el('button', 'shell-pill', `🔒 ${heStrings.parentArea}`);
  parentBtn.dataset.testid = 'parent-gate-btn';
  parentBtn.style.position = 'absolute';
  parentBtn.style.insetInlineStart = 'max(2vmin, env(safe-area-inset-left))';
  parentBtn.style.bottom = 'max(2vmin, env(safe-area-inset-bottom))';
  if (onParentLongPress) attachLongPress(parentBtn, { onTap: onParent, onLongPress: onParentLongPress });
  else parentBtn.addEventListener('click', onParent);
  screen.appendChild(parentBtn);

  root.replaceChildren(screen);
}
