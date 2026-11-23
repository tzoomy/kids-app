// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/pwa', () => ({ pwaNeedsRefresh: () => false, applyPwaUpdate: async () => {} }));

import { renderParentSettings, type ParentProfileEdit, type ParentSettingsCallbacks } from '@/ui/parent';
import { collectParentLevelGames, type ParentLevelsApi } from '@/ui/parentLevels';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { skillKey } from '@/core/adaptive';
import { defaultAppState, type AppState } from '@/core/storage/schema';
import type { StorageDriver } from '@/core/storage/store';
import {
  loadAnimalRestaurant,
  loadLetterMonster,
  loadTravelSuitcase,
  loadWordTrain,
  loadLeisureColouring,
  loadStickerBoard,
  loadWorlds,
} from '@/content/loadContent';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const bundle = {
  worlds: loadWorlds(),
  restaurant: loadAnimalRestaurant(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  wordTrain: loadWordTrain(),
  colouring: loadLeisureColouring(),
  stickers: loadStickerBoard(),
};

let root: HTMLElement;
let state: AppState;
let adaptive: AdaptiveStore;
let levels: ParentLevelsApi;
let cb: ParentSettingsCallbacks & { edits: ParentProfileEdit[] };

function mount(openProfileId?: string): void {
  const edits: ParentProfileEdit[] = [];
  cb = {
    edits,
    onSave: vi.fn(),
    onExit: vi.fn(),
    onResetBalance: vi.fn(),
    onPlusFive: vi.fn(),
    onOpenCredits: vi.fn(),
    onProfileChange: vi.fn((e: ParentProfileEdit) => {
      edits.push(e);
    }),
  };
  renderParentSettings(root, state, cb, { levels, openProfileId });
}

const q = <T extends HTMLElement = HTMLElement>(id: string): T | null => root.querySelector<T>(`[data-testid="${id}"]`);
const must = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = q<T>(id);
  if (!node) throw new Error(`missing ${id}`);
  return node;
};
function setSelect(id: string, value: string): void {
  const s = must<HTMLSelectElement>(id);
  s.value = value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}
const click = (id: string): void => must(id).click();
const levelText = (game: string, lang: string): number => Number(must(`parent-level-${game}-${lang}`).textContent);

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.appendChild(root);
  state = defaultAppState();
  state.data.a = { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day: '2026-11-23', stars: 0 };
  state.data.b = { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day: '2026-11-23', stars: 0 };
  adaptive = new AdaptiveStore(memoryDriver());
  levels = {
    games: collectParentLevelGames(bundle as unknown as Record<string, unknown>),
    getSkill: (p, k) => adaptive.getSkill(p, k),
    saveSkill: (p, k, s) => {
      adaptive.setSkill(p, k, s);
      adaptive.persist(p);
    },
  };
});

describe('main parent settings screen', () => {
  it('has no global language select, keeps time fields, build info, credits, save and exit', () => {
    mount();
    expect(root.querySelectorAll('select').length).toBe(0);
    expect(root.querySelectorAll('input[type="number"]').length).toBe(4);
    for (const id of ['parent-exit-btn', 'parent-build-info', 'parent-credits-btn']) expect(q(id)).not.toBeNull();
    expect(q('parent-profile-page')).toBeNull();
  });

  it('lists both girls as cards that open their profile page', () => {
    mount();
    expect(must('parent-open-profile-a').textContent).toContain('הקטנה');
    expect(must('parent-open-profile-b').textContent).toContain('הגדולה');
    click('parent-open-profile-b');
    expect(q('parent-profile-page')).not.toBeNull();
    expect(q('parent-profile-page-b')).not.toBeNull();
    expect(q('parent-exit-btn')).toBeNull();
  });

  it('can be opened straight on a profile page', () => {
    mount('b');
    expect(q('parent-profile-page-b')).not.toBeNull();
  });

  it('Back returns to the main screen and keeps typed global time fields', () => {
    mount();
    const learn = root.querySelector<HTMLInputElement>('input[type="number"]')!;
    learn.value = '17';
    click('parent-open-profile-a');
    click('parent-profile-back');
    expect(q('parent-profile-page')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('17');
  });

  it('Save sends the typed time fields and the profile edits including languages', () => {
    mount();
    click('parent-open-profile-b');
    setSelect('parent-profile-languages', 'fr');
    click('parent-profile-back');
    click('parent-save-btn');
    const [settings, edits] = (cb.onSave as ReturnType<typeof vi.fn>).mock.calls[0] as [AppState['settings'], ParentProfileEdit[]];
    expect(settings.learnMinutes).toBe(10);
    expect(edits.find((e) => e.id === 'b')).toMatchObject({ languages: 'fr', ageTrack: 'age5', startFrenchHigher: false, difficulty: 'regular' });
    expect(edits.find((e) => e.id === 'a')?.languages).toBe('both');
  });
});

describe('press-through', () => {
  it('presses on the main screen and on a profile page never reach window listeners (Phaser map underneath)', () => {
    const seen: string[] = [];
    const types = ['pointerdown', 'mousedown', 'touchstart'];
    const listener = (e: Event): void => void seen.push(e.type);
    for (const t of types) window.addEventListener(t, listener);
    mount();
    for (const t of types) must('parent-open-profile-a').dispatchEvent(new Event(t, { bubbles: true }));
    click('parent-open-profile-b');
    for (const t of types) must('parent-profile-back').dispatchEvent(new Event(t, { bubbles: true }));
    for (const t of types) window.removeEventListener(t, listener);
    expect(seen).toEqual([]);
  });
});

describe('profile page: language, French-higher, difficulty', () => {
  it('each profile keeps its own language (a en, b fr) and the page reflects it', () => {
    mount('a');
    setSelect('parent-profile-languages', 'en');
    click('parent-profile-back');
    click('parent-open-profile-b');
    expect(must<HTMLSelectElement>('parent-profile-languages').value).toBe('both');
    setSelect('parent-profile-languages', 'fr');
    click('parent-profile-back');
    click('parent-open-profile-a');
    expect(must<HTMLSelectElement>('parent-profile-languages').value).toBe('en');
    click('parent-profile-back');
    click('parent-open-profile-b');
    expect(must<HTMLSelectElement>('parent-profile-languages').value).toBe('fr');
    expect(cb.edits.some((e) => e.id === 'b' && e.languages === 'fr')).toBe(true);
    expect(cb.edits.some((e) => e.id === 'a' && e.languages === 'en')).toBe(true);
  });

  it('shows the profile language from the state when it is already saved', () => {
    state.profiles[1].languages = 'fr';
    mount('b');
    expect(must<HTMLSelectElement>('parent-profile-languages').value).toBe('fr');
  });

  it('offers French-higher and difficulty for age5 only', () => {
    mount('b');
    expect(q('parent-profile-start-french-higher')).not.toBeNull();
    expect(q('parent-profile-difficulty')).not.toBeNull();
    click('parent-profile-back');
    click('parent-open-profile-a');
    expect(q('parent-profile-start-french-higher')).toBeNull();
    expect(q('parent-profile-difficulty')).toBeNull();
  });

  it('hides and shows them live when the age select changes', () => {
    mount('b');
    setSelect('parent-profile-age-track', 'age2');
    expect(q('parent-profile-start-french-higher')).toBeNull();
    expect(q('parent-profile-difficulty')).toBeNull();
    expect(cb.edits.at(-1)).toMatchObject({ id: 'b', ageTrack: 'age2' });
    setSelect('parent-profile-age-track', 'age5');
    expect(q('parent-profile-start-french-higher')).not.toBeNull();
    expect(q('parent-profile-difficulty')).not.toBeNull();
  });

  it('toggling French-higher and difficulty reports the edit', () => {
    mount('b');
    const toggle = must<HTMLInputElement>('parent-profile-start-french-higher');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    setSelect('parent-profile-difficulty', 'challenging');
    expect(cb.edits.at(-1)).toMatchObject({ id: 'b', startFrenchHigher: true, difficulty: 'challenging' });
  });

  it('Reset balance and +5 minutes call the same callbacks with the profile id', () => {
    mount('b');
    click('parent-profile-reset-balance');
    click('plus-five-b');
    expect(cb.onResetBalance).toHaveBeenCalledWith('b');
    expect(cb.onPlusFive).toHaveBeenCalledWith('b');
  });
});

describe('profile page: per-game levels', () => {
  it('lists every adaptive game of the bundle once per supported language, none for leisure-only games', () => {
    mount('b');
    for (const lang of ['en', 'fr']) {
      expect(q(`parent-level-letter-monster-${lang}`)).not.toBeNull();
      expect(q(`parent-level-animal-restaurant-${lang}`)).not.toBeNull();
    }
    expect(q('parent-level-word-train-en')).not.toBeNull();
    expect(q('parent-level-word-train-fr')).not.toBeNull();
    expect(root.querySelector('[data-testid^="parent-level-leisure-colouring"]')).toBeNull();
    expect(root.querySelector('[data-testid^="parent-level-sticker-board"]')).toBeNull();
  });

  it('an unstarted game shows the track start and a not-started note', () => {
    mount('b');
    expect(levelText('animal-restaurant', 'en')).toBe(5);
    expect(must('parent-level-note-animal-restaurant-en').textContent).toBe('טרם התחילה');
  });

  it('French-higher raises only the unstarted fr start of age5, and age2 ignores it', () => {
    state.profiles[1].startFrenchHigher = true;
    mount('b');
    expect(levelText('animal-restaurant', 'fr')).toBe(6);
    expect(levelText('animal-restaurant', 'en')).toBe(5);
    click('parent-profile-back');
    state.profiles[0].startFrenchHigher = true;
    click('parent-open-profile-a');
    expect(levelText('animal-restaurant', 'fr')).toBe(4);
  });

  it('toggling French-higher live updates the displayed unstarted start levels', () => {
    mount('b');
    expect(levelText('animal-restaurant', 'fr')).toBe(5);
    const toggle = must<HTMLInputElement>('parent-profile-start-french-higher');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(levelText('animal-restaurant', 'fr')).toBe(6);
  });

  it('challenging raises unstarted starts (letter-monster age5 3 -> 5; restaurant 5 -> 7)', () => {
    mount('b');
    setSelect('parent-profile-difficulty', 'challenging');
    expect(levelText('animal-restaurant', 'en')).toBe(7);
    expect(levelText('letter-monster', 'en')).toBe(5);
  });

  it('+ and - persist immediately, and are clamped to the age5 bounds (letter-monster 2..8)', () => {
    mount('b');
    expect(levelText('letter-monster', 'en')).toBe(3);
    click('parent-level-up-letter-monster-en');
    expect(levelText('letter-monster', 'en')).toBe(4);
    expect(adaptive.getSkill('b', skillKey('language-house', 'letter-monster', 'en'))?.level).toBe(4);
    for (let i = 0; i < 6; i++) click('parent-level-up-letter-monster-en');
    expect(levelText('letter-monster', 'en')).toBe(8);
    expect(must<HTMLButtonElement>('parent-level-up-letter-monster-en').disabled).toBe(true);
    for (let i = 0; i < 8; i++) click('parent-level-down-letter-monster-en');
    expect(levelText('letter-monster', 'en')).toBe(2);
    expect(must<HTMLButtonElement>('parent-level-down-letter-monster-en').disabled).toBe(true);
    expect(adaptive.getSkill('b', skillKey('language-house', 'letter-monster', 'en'))?.level).toBe(2);
    expect(adaptive.getSkill('b', skillKey('language-house', 'letter-monster', 'fr'))).toBeUndefined();
  });

  it('age2 + stops at the age2 max (letter-monster 1..2) and never exceeds it', () => {
    mount('a');
    click('parent-level-up-letter-monster-fr');
    click('parent-level-up-letter-monster-fr');
    click('parent-level-up-letter-monster-fr');
    expect(levelText('letter-monster', 'fr')).toBe(2);
    expect(adaptive.getSkill('a', skillKey('language-house', 'letter-monster', 'fr'))?.level).toBe(2);
  });

  it('the first + on an unstarted game with French-higher persists start + 1 clamped', () => {
    state.profiles[1].startFrenchHigher = true;
    mount('b');
    click('parent-level-up-animal-restaurant-fr');
    expect(levelText('animal-restaurant', 'fr')).toBe(7);
    expect(must('parent-level-note-animal-restaurant-fr').textContent).not.toBe('טרם התחילה');
  });

  it('Reset restores the effective start and clears history; it is a no-op on an unstarted game and spares other keys', () => {
    state.profiles[1].startFrenchHigher = true;
    const frKey = skillKey('language-house', 'animal-restaurant', 'fr');
    const enKey = skillKey('language-house', 'animal-restaurant', 'en');
    adaptive.setSkill('b', frKey, {
      level: 9,
      cleanStreak: 2,
      recent: ['clean'],
      afterDrop: false,
      lastPlayedDay: '2026-11-20',
      items: { apple: { box: 3, seen: 3, clean: 3, lastSeenDay: '2026-11-20' } },
    });
    adaptive.setSkill('b', enKey, { ...adaptive.getSkill('b', frKey)!, level: 8 });
    mount('b');
    expect(levelText('animal-restaurant', 'fr')).toBe(9);
    click('parent-level-reset-animal-restaurant-fr');
    expect(levelText('animal-restaurant', 'fr')).toBe(6);
    const fr = adaptive.getSkill('b', frKey)!;
    expect(fr.level).toBe(6);
    expect(fr.items).toEqual({});
    expect(fr.cleanStreak).toBe(0);
    expect(adaptive.getSkill('b', enKey)?.level).toBe(8);
    click('parent-level-reset-letter-monster-fr');
    expect(adaptive.getSkill('b', skillKey('language-house', 'letter-monster', 'fr'))).toBeUndefined();
  });
});
