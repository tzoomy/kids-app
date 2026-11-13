import { el, formatClock } from './dom';
import { isTimeEarningEnabled, type AppState, type LanguageSetting } from '../core/storage/schema';
import heStrings from '../content/i18n/he.json';
import { applyPwaUpdate, pwaNeedsRefresh } from '../pwa';

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

export interface ParentSettingsCallbacks {
  onSave: (next: AppState['settings'], profileEdits: { id: string; name: string; ageTrack: 'age2' | 'age5' }[]) => void;
  onExit: () => void;
  onResetBalance: (profileId: string) => void;
  onPlusFive: (profileId: string) => void;
  onOpenCredits: () => void;
}

export function renderParentSettings(root: HTMLElement, state: AppState, callbacks: ParentSettingsCallbacks): void {
  const t = heStrings.parent;
  const screen = el('div', 'shell-fullscreen');
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

  const learnInput = mkNumberField(t.learnMinutesLabel, state.settings.learnMinutes, 1);
  const leisureInput = mkNumberField(t.leisureMinutesLabel, state.settings.leisureMinutes, 0);
  const capInput = mkNumberField(t.dailyCapLabel, state.settings.dailyEarnCapMinutes, 0);
  const idleInput = mkNumberField(t.idleSecondsLabel, state.settings.idleSeconds, 5);

  const langLabel = el('label');
  langLabel.appendChild(el('span', undefined, t.languagesLabel));
  const langSelect = el('select');
  const options: [LanguageSetting, string][] = [
    ['both', t.languagesBoth],
    ['en', t.languagesEn],
    ['fr', t.languagesFr],
  ];
  for (const [value, text] of options) {
    const opt = el('option', undefined, text);
    opt.value = value;
    langSelect.appendChild(opt);
  }
  langSelect.value = state.settings.languages;
  langLabel.appendChild(langSelect);
  body.appendChild(langLabel);

  body.appendChild(el('hr'));

  const profileInputs: { id: string; nameInput: HTMLInputElement; ageSelect: HTMLSelectElement }[] = [];
  for (const profile of state.profiles) {
    const data = state.data[profile.id];
    const label = el('label', 'shell-profile-edit');
    const nameInput = el('input');
    nameInput.value = profile.name;
    nameInput.style.width = '140px';
    const ageSelect = el('select');
    const age2 = el('option', undefined, t.ageTrack2);
    age2.value = 'age2';
    const age5 = el('option', undefined, t.ageTrack5);
    age5.value = 'age5';
    ageSelect.appendChild(age2);
    ageSelect.appendChild(age5);
    ageSelect.value = profile.ageTrack;
    label.appendChild(nameInput);
    label.appendChild(ageSelect);
    body.appendChild(label);
    profileInputs.push({ id: profile.id, nameInput, ageSelect: ageSelect as HTMLSelectElement });

    const note = el(
      'div',
      'shell-note',
      `${t.participationTotal}: ${formatClock(data.activeSec)} · ${t.balance}: ${formatClock(data.balanceSec)} · ${t.earnedToday}: ${formatClock(data.earnedTodaySec)} · ⭐${data.stars}`,
    );
    body.appendChild(note);

    const actionRow = el('div', 'shell-row');
    const resetBtn = el('button', 'shell-btn', t.resetBalance);
    resetBtn.style.fontSize = '14px';
    resetBtn.style.minHeight = '44px';
    resetBtn.addEventListener('click', () => callbacks.onResetBalance(profile.id));
    const plusBtn = el('button', 'shell-btn', t.plusFive);
    plusBtn.dataset.testid = `plus-five-${profile.id}`;
    plusBtn.style.fontSize = '14px';
    plusBtn.style.minHeight = '44px';
    plusBtn.addEventListener('click', () => callbacks.onPlusFive(profile.id));
    actionRow.appendChild(resetBtn);
    actionRow.appendChild(plusBtn);
    body.appendChild(actionRow);
  }

  body.appendChild(el('p', 'shell-note', t.placeholderNote));
  body.appendChild(el('p', 'shell-note', t.wipeNote));
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
  const exitBtn = el('button', 'shell-btn', t.exit);
  exitBtn.dataset.testid = 'parent-exit-btn';
  saveBtn.addEventListener('click', () => {
    const next: AppState['settings'] = {
      learnMinutes: Math.max(1, Number(learnInput.value) || state.settings.learnMinutes),
      leisureMinutes: Math.max(0, Number(leisureInput.value) || 0),
      dailyEarnCapMinutes: Math.max(0, Number(capInput.value) || 0),
      idleSeconds: Math.max(5, Number(idleInput.value) || state.settings.idleSeconds),
      languages: langSelect.value as LanguageSetting,
      timeEarning: { enabled: isTimeEarningEnabled(state.settings) },
    };
    const edits = profileInputs.map((p) => ({
      id: p.id,
      name: p.nameInput.value || '',
      ageTrack: p.ageSelect.value as 'age2' | 'age5',
    }));
    callbacks.onSave(next, edits);
  });
  exitBtn.addEventListener('click', callbacks.onExit);
  buttonRow.appendChild(saveBtn);
  buttonRow.appendChild(exitBtn);
  card.appendChild(buttonRow);

  screen.appendChild(card);
  root.replaceChildren(screen);
}
