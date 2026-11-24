// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/pwa', () => ({ pwaNeedsRefresh: () => false, applyPwaUpdate: async () => {} }));

import { renderParentSettings, type ParentProfileEdit, type ParentSettingsCallbacks } from '@/ui/parent';
import { defaultAppState, type AppState } from '@/core/storage/schema';

let root: HTMLElement;
let state: AppState;
let cb: ParentSettingsCallbacks & { edits: ParentProfileEdit[] };

function mount(openProfileId?: string): void {
  const edits: ParentProfileEdit[] = [];
  cb = {
    edits,
    onSave: vi.fn(),
    onExit: vi.fn(),
    onResetBalance: vi.fn(),
    onPlusFive: vi.fn(),
    onResetProgress: vi.fn(),
    onOpenCredits: vi.fn(),
    onProfileChange: vi.fn((e: ParentProfileEdit) => {
      edits.push(e);
    }),
  };
  renderParentSettings(root, state, cb, { openProfileId });
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

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.appendChild(root);
  state = defaultAppState();
  state.data.a = { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day: '2026-11-23', stars: 0 };
  state.data.b = { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day: '2026-11-23', stars: 0 };
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

describe('profile page: generic across games', () => {
  it('[AC-01] shows name, age track, language and age5 options, with no per-game level list or controls', () => {
    mount('b');
    for (const id of ['parent-profile-name', 'parent-profile-age-track', 'parent-profile-languages', 'parent-profile-start-french-higher', 'parent-profile-difficulty']) {
      expect(q(id), id).not.toBeNull();
    }
    expect(root.querySelector('[data-testid^="parent-level"]')).toBeNull();
    expect(root.querySelector('.shell-levels, .shell-level-game, .shell-level-row, .shell-level-btn')).toBeNull();
    expect(root.querySelectorAll('h3, h4').length).toBe(0);
    expect(root.textContent).not.toContain('טרם התחילה');
  });

  it('[AC-01] the age5-only hints say that already-started games are raised and that turning off keeps progress', () => {
    mount('b');
    const notes = [...root.querySelectorAll('.shell-note')].map((n) => n.textContent ?? '');
    const fr = notes.find((n) => n.includes('צרפתית'));
    const diff = notes.find((n) => n.includes('מאתגר'));
    expect(fr).toContain('שהתחילה');
    expect(fr).toContain('לא מוריד');
    expect(diff).toContain('שהתחילה');
    expect(diff).toContain('לא מוריד');
    expect(notes.join(' ')).not.toContain('בלי לשנות משחקים שהתחילה');
    expect(notes.join(' ')).not.toContain('חל רק על משחקים חדשים');
  });

  it('[AC-02] an age2 profile has no age5-only controls and no reset of start floors, and switching live hides and shows them', () => {
    mount('a');
    expect(q('parent-profile-start-french-higher')).toBeNull();
    expect(q('parent-profile-difficulty')).toBeNull();
    setSelect('parent-profile-age-track', 'age5');
    expect(q('parent-profile-start-french-higher')).not.toBeNull();
    setSelect('parent-profile-age-track', 'age2');
    expect(q('parent-profile-start-french-higher')).toBeNull();
    expect(q('parent-profile-difficulty')).toBeNull();
  });

  it('[AC-02] changing the age track, name or language alone reports no start-option change', () => {
    mount('b');
    setSelect('parent-profile-age-track', 'age2');
    setSelect('parent-profile-languages', 'fr');
    for (const edit of cb.edits) expect(edit).toMatchObject({ startFrenchHigher: false, difficulty: 'regular' });
  });
});

describe('profile page: reset progress (two-step inline confirm)', () => {
  it('[AC-08] sits at the bottom of the profile page, below the leisure controls and above Back', () => {
    mount('b');
    const buttons = [...root.querySelectorAll('button')].map((b) => b.dataset.testid);
    expect(buttons.indexOf('parent-profile-reset-progress')).toBeGreaterThan(buttons.indexOf('plus-five-b'));
    expect(buttons.indexOf('parent-profile-reset-progress')).toBeLessThan(buttons.indexOf('parent-profile-back'));
    expect(must('parent-profile-reset-progress').textContent).toBe('איפוס התקדמות');
  });

  it('[AC-08] a single click only asks for confirmation; nothing is reset and no window.confirm is used', () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmSpy);
    mount('b');
    click('parent-profile-reset-progress');
    expect(cb.onResetProgress).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(q('parent-profile-reset-progress')).toBeNull();
    expect(must('parent-profile-reset-progress-confirm-text').textContent).toContain('הגדולה');
    expect(q('parent-profile-reset-progress-confirm')).not.toBeNull();
    expect(q('parent-profile-reset-progress-cancel')).not.toBeNull();
    expect(q('parent-profile-page-b')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('[AC-08] the second step (confirm) resets exactly this profile once and commits pending edits first', () => {
    mount('b');
    setSelect('parent-profile-languages', 'fr');
    click('parent-profile-reset-progress');
    click('parent-profile-reset-progress-confirm');
    expect(cb.onResetProgress).toHaveBeenCalledTimes(1);
    expect(cb.onResetProgress).toHaveBeenCalledWith('b');
    expect(cb.edits.at(-1)).toMatchObject({ id: 'b', languages: 'fr' });
  });

  it('[AC-10] cancel returns to the single button and resets nothing; the page stays on the profile', () => {
    mount('b');
    click('parent-profile-reset-progress');
    click('parent-profile-reset-progress-cancel');
    expect(cb.onResetProgress).not.toHaveBeenCalled();
    expect(q('parent-profile-reset-progress')).not.toBeNull();
    expect(q('parent-profile-reset-progress-confirm')).toBeNull();
    expect(q('parent-profile-page-b')).not.toBeNull();
    click('parent-profile-reset-progress');
    click('parent-profile-back');
    expect(cb.onResetProgress).not.toHaveBeenCalled();
  });

  it('[AC-10] the confirm step does not survive leaving and re-opening the profile page', () => {
    mount('b');
    click('parent-profile-reset-progress');
    click('parent-profile-back');
    click('parent-open-profile-b');
    expect(q('parent-profile-reset-progress')).not.toBeNull();
    expect(q('parent-profile-reset-progress-confirm')).toBeNull();
  });
});
