// Enumerates every voice line the games can request (lineId, lang, text) by calling the games' own line
// builders over all content. Used by tests/unit/gameVoiceLines.test.ts to keep scripts/tts/game-lines.json
// (the render list for scripts/tts/generate_voice.py) in sync with the game text.
import {
  loadAnimalRestaurant,
  loadBalloonPop,
  loadKitchenOrchestra,
  loadLetterMonster,
  loadMagicMagnet,
  loadNumberBridge,
  loadPotionLab,
  loadSeedToFlower,
  loadShadowMatch,
  loadSinkOrFloat,
  loadStickerBoard,
  loadTravelSuitcase,
  loadWhoLivesHere,
  loadWhosHiding,
  loadWordTrain,
} from '@/content/loadContent';
import type { SpeechRequest } from '@/core/audio/types';
import { buildBalloonRound, balloonLevel, eligibleItemIds } from '@/games/balloon/balloonRound';
import { COLOURING_VOICE } from '@/games/colouring/voice';
import { HABITAT_HE_TEXT, clueLine, correctLines, helpLine, nameLine as habitatNameLine } from '@/games/habitat/habitatVoice';
import { buildHidingRound } from '@/games/hiding/hidingRound';
import { buildShadowRound } from '@/games/hiding/shadowRound';
import * as monster from '@/games/letterMonster/monsterRound';
import * as magnet from '@/games/magicMagnet/magnetRound';
import * as bridge from '@/games/numberBridge/bridgeRound';
import { PICNIC_LINE_TEXT } from '@/games/picnic/picnicVoice';
import * as potion from '@/games/potionLab/potionRound';
import { POTION_COLORS, SECONDARY_COLORS } from '@/games/potionLab/potionMachine';
import * as seed from '@/games/seedFlower/seedFlowerRound';
import { SEED_STAGES } from '@/games/seedFlower/seedFlowerMachine';
import * as sink from '@/games/sinkFloat/sinkFloatRound';
import { SORTING_LINE_TEXT } from '@/games/sorting/sortingVoice';
import { requestLine as stickerRequestLine } from '@/games/stickers/request';
import { STICKER_VOICE } from '@/games/stickers/voice';
import * as suitcase from '@/games/travelSuitcase/suitcaseRound';
import * as train from '@/games/wordTrain/wordTrainRound';

export interface GameVoiceLine {
  id: string;
  lang: 'en' | 'fr' | 'he';
  text: string;
  game: string;
  /** Combinatorial request (every ordered pair of items): rendered last. */
  combo?: boolean;
}

const LANGS = ['en', 'fr'] as const;
const fixed = () => 0;

export function enumerateGameVoiceLines(): { lines: GameVoiceLine[]; conflicts: Record<string, string[]> } {
  const out: GameVoiceLine[] = [];
  const add = (game: string, r: { lineId: string; lang: string; text: string }, combo = false) =>
    out.push({ id: r.lineId, lang: r.lang as GameVoiceLine['lang'], text: r.text, game, ...(combo ? { combo } : {}) });

  // Animal Restaurant: two-step pair requests (food/attr/not/thanks are rendered from the restaurant JSON directly).
  const rest = loadAnimalRestaurant();
  for (const lang of LANGS)
    for (const a of rest.items)
      for (const b of rest.items)
        if (a.id !== b.id)
          add('animal-restaurant', {
            lineId: `pair.${a.id}.${b.id}.${lang}`,
            lang,
            text: rest.twoStepFrames[lang].replace('{a}', a.phrase[lang]).replace('{b}', b.phrase[lang]),
          }, true);

  // Kitchen Orchestra.
  const orch = loadKitchenOrchestra();
  add('kitchen-orchestra', { lineId: 'orchestra.help.he', lang: 'he', text: orch.helpTextHe });
  for (const lang of LANGS) {
    add('kitchen-orchestra', { lineId: `orchestra.listen.${lang}`, lang, text: orch.listenPrompt[lang] });
    add('kitchen-orchestra', { lineId: `orchestra.yourturn.${lang}`, lang, text: orch.yourTurnPrompt[lang] });
    add('kitchen-orchestra', { lineId: `orchestra.retry.${lang}`, lang, text: orch.retryPrompt[lang] });
    orch.thanks[lang].forEach((t, i) => add('kitchen-orchestra', { lineId: `orchestra.thanks.${lang}.${i}`, lang, text: t }));
    for (const inst of orch.instruments) {
      if (inst.id === 'pan' && lang === 'fr') continue; // orchestra.play.pan.fr is rendered by generate_voice.py (POELE_LINE)
      add('kitchen-orchestra', { lineId: `orchestra.play.${inst.id}.${lang}`, lang, text: inst.prompts[lang] ?? `Play the ${inst.id}!` });
    }
  }

  // Who's Hiding?
  const hiding = loadWhosHiding();
  for (const lang of LANGS) {
    hiding.found[lang].forEach((t, i) => add('who-is-hiding', { lineId: `hiding.found.${lang}.${i}`, lang, text: t }));
    for (const level of hiding.adaptive.levels)
      for (const a of hiding.animals) {
        const r = buildHidingRound(hiding, level, lang, a.id, fixed);
        add('who-is-hiding', { lineId: r.lineId, lang, text: r.promptText });
        add('who-is-hiding', { lineId: r.hintLineId, lang, text: r.hintText });
      }
  }

  // Shadow Match.
  const shadow = loadShadowMatch();
  add('shadow-match', { lineId: 'he.shadow.intro', lang: 'he', text: shadow.introHe });
  add('shadow-match', { lineId: 'he.shadow.help', lang: 'he', text: shadow.helpTextHe });
  for (const lang of LANGS)
    for (const level of shadow.adaptive.levels)
      for (const a of hiding.animals) {
        const r = buildShadowRound(shadow, hiding.animals, level, lang, a.id, fixed);
        add('shadow-match', { lineId: r.lineId, lang, text: r.promptText });
        add('shadow-match', { lineId: r.revealLineId, lang, text: r.revealText });
        add('shadow-match', { lineId: r.revealLineIdHe, lang: 'he', text: r.revealTextHe });
      }

  // Balloon Pop (static and floating stage share the same lines).
  const balloon = loadBalloonPop();
  add('balloon-pop', { lineId: 'he.balloon.intro', lang: 'he', text: balloon.introHe });
  add('balloon-pop', { lineId: 'he.balloon.help', lang: 'he', text: balloon.helpTextHe });
  for (const lang of LANGS) {
    balloon.popped[lang].forEach((t, i) => add('balloon-pop', { lineId: `balloon.popped.${lang}.${i}`, lang, text: t }));
    for (const level of balloon.adaptive.levels)
      for (const id of eligibleItemIds(balloon, balloonLevel(level))) {
        const r = buildBalloonRound(balloon, level, lang, id, fixed);
        add('balloon-pop', { lineId: r.lineId, lang, text: r.promptText });
      }
  }

  // Who Lives Here?
  const habitat = loadWhoLivesHere();
  for (const id of Object.keys(HABITAT_HE_TEXT) as (keyof typeof HABITAT_HE_TEXT)[])
    if (id !== 'habitat.help.he') add('who-lives-here', { lineId: id, lang: 'he', text: HABITAT_HE_TEXT[id] });
  add('who-lives-here', helpLine(habitat.helpTextHe));
  for (const lang of LANGS)
    for (const a of habitat.animals) {
      add('who-lives-here', habitatNameLine(a, lang));
      add('who-lives-here', clueLine(a, lang));
      for (const l of correctLines(habitat, a, lang)) if (l.lang !== 'he') add('who-lives-here', l);
    }

  // Sorting Beds and Picnic Train (text tables).
  for (const [id, text] of Object.entries(SORTING_LINE_TEXT)) add('sorting-beds', { lineId: id, lang: id.slice(-2), text });
  for (const [id, text] of Object.entries(PICNIC_LINE_TEXT)) add('picnic-train', { lineId: id, lang: id.slice(-2), text });

  // Colouring Time and Sticker Board.
  for (const r of Object.values(COLOURING_VOICE)) add('leisure-colouring', r);
  const stickers = loadStickerBoard();
  for (const r of Object.values(STICKER_VOICE)) add('sticker-board', r);
  for (const lang of LANGS)
    for (const s of stickers.stickers)
      for (const bg of stickers.backgrounds) {
        if (s.theme !== bg.id) continue;
        const lineId = `sticker-board.request.${s.id}.${lang}`;
        add('sticker-board', stickerRequestLine({ stickerId: s.id, backgroundId: bg.id, lang, lineId }, stickers));
      }

  // Word Train.
  const wt = loadWordTrain();
  add('word-train', train.introLine(wt, 'load'));
  add('word-train', train.introLine(wt, 'spell'));
  add('word-train', { lineId: 'wordtrain.help.he', lang: 'he', text: wt.helpTextHe });
  for (const o of wt.objects) {
    add('word-train', train.loadLine(wt, o.id));
    add('word-train', train.nameLine(wt, o.id));
    add('word-train', train.otherLine(wt, o.id));
  }
  for (const w of wt.words) {
    add('word-train', train.spellLine(wt, w.id));
    add('word-train', train.wordLine(wt, w.id));
  }
  const letters = new Set((wt.words.map((w) => w.word).join('') + wt.distractorLetters).toLowerCase().replace(/[^a-z]/g, ''));
  for (const ch of [...letters].sort()) add('word-train', train.letterLine(ch));

  // Letter Monster.
  const lm = loadLetterMonster();
  add('letter-monster', monster.introLine(lm));
  add('letter-monster', monster.askLetterLine(lm));
  add('letter-monster', monster.notThisLine(lm));
  add('letter-monster', { lineId: 'monster.help.he', lang: 'he', text: lm.helpTextHe });
  for (const color of Object.keys(lm.colors) as (keyof typeof lm.colors)[]) {
    add('letter-monster', monster.askColorLine(lm, color));
    for (const lang of LANGS) add('letter-monster', monster.colorWordLine(lm, color, lang));
  }
  for (const lang of LANGS) {
    for (const f of lm.foods) add('letter-monster', monster.foodLine(lm, f.id, lang));
    for (const letter of [...new Set(lm.foods.map((f) => f.initial[lang].toUpperCase()))].sort())
      add('letter-monster', monster.letterModelLine(lm, letter, lang));
  }

  // Number Bridge (the game's own render list, incl. the age-5 equation lines).
  const nb = loadNumberBridge();
  for (const r of bridge.allBridgeVoiceLines(nb)) add('number-bridge', r);
  add('number-bridge', { lineId: 'bridge.help.he', lang: 'he', text: nb.helpTextHe });

  // Potion Lab.
  const pl = loadPotionLab();
  add('potion-lab', potion.introLine(pl, 'free'));
  add('potion-lab', potion.introLine(pl, 'request'));
  add('potion-lab', { lineId: 'potion.help.he', lang: 'he', text: pl.helpTextHe });
  for (const c of SECONDARY_COLORS) {
    add('potion-lab', potion.requestLine(pl, c));
    add('potion-lab', potion.tryAgainLine(pl, c));
  }
  for (const c of POTION_COLORS) for (const lang of ['he', 'en', 'fr'] as const) add('potion-lab', potion.colorLine(pl, c, lang));

  // Sink or Float.
  const sf = loadSinkOrFloat();
  add('sink-or-float', sink.introLine(sf, 'free'));
  add('sink-or-float', sink.introLine(sf, 'predict'));
  add('sink-or-float', sink.askLine(sf));
  add('sink-or-float', sink.letsSeeLine(sf));
  add('sink-or-float', { lineId: 'sinkFloat.help.he', lang: 'he', text: sf.helpTextHe });
  for (const o of sf.objects) add('sink-or-float', sink.resultHeLine(sf, o.id));
  for (const lang of LANGS) for (const outcome of ['floats', 'sinks'] as const) add('sink-or-float', sink.resultLearningLine(sf, outcome, lang));

  // Magic Magnet.
  const mm = loadMagicMagnet();
  add('magic-magnet', magnet.introLine(mm, 'free'));
  add('magic-magnet', magnet.introLine(mm, 'predict'));
  add('magic-magnet', magnet.testLine(mm));
  add('magic-magnet', magnet.rightLine(mm));
  add('magic-magnet', magnet.surpriseLine(mm));
  add('magic-magnet', { lineId: 'magnet.help.he', lang: 'he', text: mm.helpTextHe });
  for (const o of mm.objects)
    for (const lang of LANGS) {
      for (const l of magnet.reactionLines(mm, o.id, lang)) add('magic-magnet', l);
      for (const l of magnet.askLines(mm, o.id, lang)) add('magic-magnet', l);
    }

  // Seed to Flower.
  const sd = loadSeedToFlower();
  for (const key of ['intro.free', 'intro.ordered', 'help', 'needWater', 'needSun'] as const) add('seed-to-flower', seed.seedHeLine(sd, key));
  for (const lang of LANGS) for (const st of SEED_STAGES) add('seed-to-flower', seed.stageLine(sd, st, lang));

  // Travel Suitcase.
  const ts = loadTravelSuitcase();
  add('travel-suitcase', suitcase.introLine(ts));
  add('travel-suitcase', suitcase.closedLine(ts));
  add('travel-suitcase', { lineId: 'suitcase.help.he', lang: 'he', text: ts.helpTextHe });
  for (const lang of LANGS) {
    const choiceIds: string[] = [];
    for (const item of ts.items) {
      choiceIds.push(item.id);
      for (const v of item.colors ?? []) choiceIds.push(`${item.id}-${v.color}`);
    }
    for (const id of choiceIds) {
      add('travel-suitcase', suitcase.nameLine(ts, id, lang));
      add('travel-suitcase', suitcase.otherLine(ts, id, lang));
    }
    const req = (kind: string, key: string, targets: string[]) =>
      suitcase.requestLine(ts, { kind, key, itemId: key, targets, needed: 1, targetItemIds: [] } as never, lang);
    for (const item of ts.items) {
      add('travel-suitcase', req('noun', item.id, [item.id]));
      for (const v of item.colors ?? []) {
        const key = `${item.id}-${v.color}`;
        add('travel-suitcase', req('attribute', key, [key]));
        add('travel-suitcase', req('negation', key, [key]));
      }
    }
    for (const a of ts.items) for (const b of ts.items) if (a.id !== b.id) add('travel-suitcase', req('two', `${a.id}-${b.id}`, [a.id, b.id]), true);
  }

  // De-duplicate ids; an id that maps to more than one text cannot have a single clip.
  const byId = new Map<string, GameVoiceLine>();
  const texts = new Map<string, Set<string>>();
  for (const l of out) {
    if (!byId.has(l.id)) byId.set(l.id, l);
    (texts.get(l.id) ?? texts.set(l.id, new Set()).get(l.id)!).add(l.text);
  }
  const conflicts: Record<string, string[]> = {};
  for (const [id, set] of texts) if (set.size > 1) conflicts[id] = [...set];
  const lines = [...byId.values()].filter((l) => !conflicts[l.id]);
  return { lines, conflicts };
}

export type { SpeechRequest };
