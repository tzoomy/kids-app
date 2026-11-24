import { el, formatClock } from './dom';
import {
  isTimeEarningEnabled,
  profileLanguageSetting,
  profileStartPrefs,
  type AgeTrack,
  type AppState,
  type DifficultyPreference,
  type LanguageSetting,
} from '../core/storage/schema';
import heStrings from '../content/i18n/he.json';
import { applyPwaUpdate, pwaNeedsRefresh } from '../pwa';
import { formatBuildInfo } from '../buildInfo';

export function renderParentGate(root: HTMLElement, onSuccess: () => void, onCancel: () => void): void {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);

  const screen = el('div', 'shell-fullscreen');
  const card = el('div', 'shell-card');
  card.appendChild(el('h2', undefined, heStrings.parent.gateTitle));
  card.appendChild(el('p', undefined, heStrings.parent.gateQuestion.replace('{a}', String(a)).replace('{b}', String(b))));

  const input = el('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.style.fontSize = '20px';
  input.style.width = '120px';
  card.appendChild(input);

  const row = el('div', 'shell-row');
  const enter = el('button', 'shell-btn', heStrings.parent.enter);
  const cancel = el('button', 'shell-btn', heStrings.parent.cancel);
  enter.addEventListener('click', () => {
    if (Number(input.value) === a * b) onSuccess();
    else onCancel();
  });
  cancel.addEventListener('click', onCancel);
  row.appendChild(enter);
  row.appendChild(cancel);
  card.appendChild(row);

  screen.appendChild(card);
  root.replaceChildren(screen);
}

/** Everything the profile page edits for one child. */
export interface ParentProfileEdit {
  id: string;
  name: string;
  ageTrack: AgeTrack;
  languages: LanguageSetting;
  startFrenchHigher: boolean;
  difficulty: DifficultyPreference;
}

/** Phaser also listens for presses on window: keep presses on the settings screens from tapping the map underneath. */
function blockPressThrough(screen: HTMLElement): void {
  for (const type of ['pointerdown', 'mousedown', 'touchstart'] as const) {
    screen.addEventListener(type, (event) => event.stopPropagation());
  }
}

export interface ParentSettingsCallbacks {
  onSave: (next: AppState['settings'], profileEdits: ParentProfileEdit[]) => void;
  /** Called after every change on a profile page (and on Back), so a child's edits are persisted without the main Save. */
  onProfileChange: (edit: ParentProfileEdit) => void;
  onExit: () => void;
  onResetBalance: (profileId: string) => void;
  onPlusFive: (profileId: string) => void;
  /** Confirmed "איפוס התקדמות": drop every saved skill of this child (nothing else). */
  onResetProgress: (profileId: string) => void;
  onOpenCredits: () => void;
}

export interface ParentSettingsView {
  /** Open straight on this child's profile page. */
  openProfileId?: string;
}

const LANGUAGE_OPTIONS: readonly LanguageSetting[] = ['both', 'en', 'fr'];

export function renderParentSettings(
  root: HTMLElement,
  state: AppState,
  callbacks: ParentSettingsCallbacks,
  view: ParentSettingsView = {},
): void {
  const t = heStrings.parent;
  const languageText: Record<LanguageSetting, string> = { both: t.languagesBoth, en: t.languagesEn, fr: t.languagesFr };
  const ageText: Record<AgeTrack, string> = { age2: t.ageTrack2, age5: t.ageTrack5 };

  const draftSettings = { ...state.settings };
  const draft = new Map<string, ParentProfileEdit>(
    state.profiles.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        ageTrack: p.ageTrack,
        languages: profileLanguageSetting(state, p.id),
        ...profileStartPrefs(state, p.id),
      },
    ]),
  );
  const edits = (): ParentProfileEdit[] => state.profiles.map((p) => ({ ...draft.get(p.id)! }));

  const mkOption = (value: string, text: string): HTMLOptionElement => {
    const opt = el('option', undefined, text);
    opt.value = value;
    return opt;
  };

  function renderMain(): void {
    const screen = el('div', 'shell-fullscreen');
    blockPressThrough(screen);
    const card = el('div', 'shell-card');
    card.appendChild(el('h2', undefined, `⚙️ ${t.settingsTitle}`));
    const body = el('div', 'shell-card-body');
    card.appendChild(body);

    const mkNumberField = (labelText: string, value: number, min: number): HTMLInputElement => {
      const label = el('label');
      label.appendChild(el('span', undefined, labelText));
      const input = el('input');
      input.type = 'number';
      input.min = String(min);
      input.value = String(value);
      label.appendChild(input);
      body.appendChild(label);
      return input;
    };

    const learnInput = mkNumberField(t.learnMinutesLabel, draftSettings.learnMinutes, 1);
    const leisureInput = mkNumberField(t.leisureMinutesLabel, draftSettings.leisureMinutes, 0);
    const capInput = mkNumberField(t.dailyCapLabel, draftSettings.dailyEarnCapMinutes, 0);
    const idleInput = mkNumberField(t.idleSecondsLabel, draftSettings.idleSeconds, 5);

    const captureTimes = (): AppState['settings'] => {
      draftSettings.learnMinutes = Math.max(1, Number(learnInput.value) || draftSettings.learnMinutes);
      draftSettings.leisureMinutes = Math.max(0, Number(leisureInput.value) || 0);
      draftSettings.dailyEarnCapMinutes = Math.max(0, Number(capInput.value) || 0);
      draftSettings.idleSeconds = Math.max(5, Number(idleInput.value) || draftSettings.idleSeconds);
      return { ...draftSettings, timeEarning: { enabled: isTimeEarningEnabled(state.settings) } };
    };

    body.appendChild(el('hr'));

    const list = el('div', 'shell-profile-list');
    for (const profile of state.profiles) {
      const edit = draft.get(profile.id)!;
      const data = state.data[profile.id];
      const open = el('button', 'shell-profile-card');
      open.type = 'button';
      open.dataset.testid = `parent-open-profile-${profile.id}`;
      open.setAttribute('aria-label', `${t.profileOpen}: ${edit.name}`);
      open.appendChild(el('span', 'shell-profile-card-name', edit.name));
      const balance = isTimeEarningEnabled(state.settings) ? ` · ${t.balance}: ${formatClock(data?.balanceSec ?? 0)}` : '';
      open.appendChild(el('span', 'shell-note', `${ageText[edit.ageTrack]}${balance} · ⭐${data?.stars ?? 0}`));
      open.addEventListener('click', () => {
        captureTimes();
        renderProfile(profile.id);
      });
      list.appendChild(open);
    }
    body.appendChild(list);

    body.appendChild(el('p', 'shell-note', t.placeholderNote));
    body.appendChild(el('p', 'shell-note', t.wipeNote));
    const buildInfo = el('p', 'shell-note', formatBuildInfo());
    buildInfo.dataset.testid = 'parent-build-info';
    buildInfo.dir = 'ltr';
    body.appendChild(buildInfo);
    if (pwaNeedsRefresh()) {
      const refresh = el('button', 'shell-btn', t.refreshApp);
      refresh.addEventListener('click', () => { void applyPwaUpdate(); });
      body.appendChild(refresh);
    }

    const creditsBtn = el('button', 'shell-btn', t.creditsOpen);
    creditsBtn.dataset.testid = 'parent-credits-btn';
    creditsBtn.addEventListener('click', callbacks.onOpenCredits);
    body.appendChild(creditsBtn);

    const buttonRow = el('div', 'shell-row shell-card-actions');
    const saveBtn = el('button', 'shell-btn', t.save);
    saveBtn.dataset.testid = 'parent-save-btn';
    const exitBtn = el('button', 'shell-btn', t.exit);
    exitBtn.dataset.testid = 'parent-exit-btn';
    saveBtn.addEventListener('click', () => callbacks.onSave(captureTimes(), edits()));
    exitBtn.addEventListener('click', callbacks.onExit);
    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(exitBtn);
    card.appendChild(buttonRow);

    screen.appendChild(card);
    root.replaceChildren(screen);
  }

  function renderProfile(profileId: string): void {
    const edit = draft.get(profileId);
    if (!edit) {
      renderMain();
      return;
    }
    const data = state.data[profileId];
    const commit = (): void => callbacks.onProfileChange({ ...edit });
    const mkLabel = (parent: HTMLElement, text: string): HTMLLabelElement => {
      const label = el('label');
      label.appendChild(el('span', undefined, text));
      parent.appendChild(label);
      return label;
    };

    const screen = el('div', 'shell-fullscreen');
    blockPressThrough(screen);
    const card = el('div', 'shell-card shell-profile-page');
    card.dataset.testid = 'parent-profile-page';
    screen.dataset.testid = `parent-profile-page-${profileId}`;
    card.appendChild(el('h2', undefined, t.profileTitle.replace('{name}', edit.name)));
    const body = el('div', 'shell-card-body');
    card.appendChild(body);

    const nameLabel = mkLabel(body, t.profileNameLabel);
    const nameInput = el('input');
    nameInput.dataset.testid = 'parent-profile-name';
    nameInput.value = edit.name;
    nameInput.addEventListener('change', () => {
      edit.name = nameInput.value || edit.name;
      commit();
    });
    nameLabel.appendChild(nameInput);

    const ageLabel = mkLabel(body, t.ageTrackLabel);
    const ageSelect = el('select');
    ageSelect.dataset.testid = 'parent-profile-age-track';
    ageSelect.appendChild(mkOption('age2', t.ageTrack2));
    ageSelect.appendChild(mkOption('age5', t.ageTrack5));
    ageSelect.value = edit.ageTrack;
    ageSelect.addEventListener('change', () => {
      edit.ageTrack = ageSelect.value as AgeTrack;
      commit();
      renderProfile(profileId);
    });
    ageLabel.appendChild(ageSelect);

    const langLabel = mkLabel(body, t.profileLanguageLabel);
    const langSelect = el('select');
    langSelect.dataset.testid = 'parent-profile-languages';
    for (const value of LANGUAGE_OPTIONS) langSelect.appendChild(mkOption(value, languageText[value]));
    langSelect.value = edit.languages;
    langSelect.addEventListener('change', () => {
      edit.languages = langSelect.value as LanguageSetting;
      commit();
    });
    langLabel.appendChild(langSelect);

    // The age5-only preferences: not rendered for age2 (the engine also ignores them there).
    if (edit.ageTrack === 'age5') {
      const frLabel = mkLabel(body, t.startFrenchHigherLabel);
      frLabel.classList.add('shell-toggle');
      const toggle = el('input');
      toggle.type = 'checkbox';
      toggle.dataset.testid = 'parent-profile-start-french-higher';
      toggle.checked = edit.startFrenchHigher;
      toggle.addEventListener('change', () => {
        edit.startFrenchHigher = toggle.checked;
        commit();
      });
      frLabel.appendChild(toggle);
      body.appendChild(el('p', 'shell-note', t.startFrenchHigherHint));

      const diffLabel = mkLabel(body, t.difficultyLabel);
      const diffSelect = el('select');
      diffSelect.dataset.testid = 'parent-profile-difficulty';
      diffSelect.appendChild(mkOption('regular', t.difficultyRegular));
      diffSelect.appendChild(mkOption('challenging', t.difficultyChallenging));
      diffSelect.value = edit.difficulty;
      diffSelect.addEventListener('change', () => {
        edit.difficulty = diffSelect.value as DifficultyPreference;
        commit();
      });
      diffLabel.appendChild(diffSelect);
      body.appendChild(el('p', 'shell-note', t.difficultyHint));
    }

    body.appendChild(el('hr'));
    if (data) {
      body.appendChild(
        el(
          'div',
          'shell-note',
          `${t.participationTotal}: ${formatClock(data.activeSec)} · ${t.balance}: ${formatClock(data.balanceSec)} · ${t.earnedToday}: ${formatClock(data.earnedTodaySec)} · ⭐${data.stars}`,
        ),
      );
    }
    const actionRow = el('div', 'shell-row shell-profile-actions');
    const resetBtn = el('button', 'shell-btn shell-btn-small', t.resetBalance);
    resetBtn.dataset.testid = 'parent-profile-reset-balance';
    resetBtn.addEventListener('click', () => {
      commit();
      callbacks.onResetBalance(profileId);
    });
    const plusBtn = el('button', 'shell-btn shell-btn-small', t.plusFive);
    plusBtn.dataset.testid = `plus-five-${profileId}`;
    plusBtn.addEventListener('click', () => {
      commit();
      callbacks.onPlusFive(profileId);
    });
    actionRow.appendChild(resetBtn);
    actionRow.appendChild(plusBtn);
    body.appendChild(actionRow);

    body.appendChild(renderResetProgress(profileId, edit.name, commit));

    const buttonRow = el('div', 'shell-row shell-card-actions');
    const backBtn = el('button', 'shell-btn', t.profileBack);
    backBtn.dataset.testid = 'parent-profile-back';
    backBtn.addEventListener('click', () => {
      commit();
      renderMain();
    });
    buttonRow.appendChild(backBtn);
    card.appendChild(buttonRow);

    screen.appendChild(card);
    root.replaceChildren(screen);
  }

  /** One child-wide "איפוס התקדמות" with a two-step inline confirmation (no native confirm). */
  function renderResetProgress(profileId: string, name: string, commit: () => void): HTMLElement {
    const box = el('div', 'shell-profile-reset');
    const showAsk = (): void => {
      const ask = el('button', 'shell-btn shell-btn-small', t.resetProgress);
      ask.type = 'button';
      ask.dataset.testid = 'parent-profile-reset-progress';
      ask.addEventListener('click', showConfirm);
      box.replaceChildren(ask, el('p', 'shell-note', t.resetProgressHint.replace('{name}', name)));
    };
    const showConfirm = (): void => {
      const text = el('p', 'shell-profile-reset-confirm', t.resetProgressConfirm.replace('{name}', name));
      text.dataset.testid = 'parent-profile-reset-progress-confirm-text';
      text.setAttribute('role', 'alert');
      const yes = el('button', 'shell-btn shell-btn-small', t.resetProgressYes);
      yes.type = 'button';
      yes.dataset.testid = 'parent-profile-reset-progress-confirm';
      yes.addEventListener('click', () => {
        commit();
        callbacks.onResetProgress(profileId);
      });
      const no = el('button', 'shell-btn shell-btn-small', t.cancel);
      no.type = 'button';
      no.dataset.testid = 'parent-profile-reset-progress-cancel';
      no.addEventListener('click', showAsk);
      const row = el('div', 'shell-row shell-profile-actions');
      row.append(yes, no);
      box.replaceChildren(text, row);
    };
    showAsk();
    return box;
  }

  if (view.openProfileId) renderProfile(view.openProfileId);
  else renderMain();
}
