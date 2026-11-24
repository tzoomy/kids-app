// Voice lines of the Animal Restaurant age-5 stretch levels (L10-L12, docs/specs/animal-restaurant.md):
// ordered pairs ("First an apple, then a banana, please!") and colour + count requests ("I want two green
// apples, please!"). The round builder (src/games/templates/choiceServe.ts) composes the same text from the
// same content frames; this list lets tests/helpers/gameVoiceLines.ts register every id in
// scripts/tts/game-lines.json. No Phaser: unit tests import it.
import type { AnimalRestaurantContent } from '../../content/schema';
import type { Lang } from '../templates/choiceServe';

export interface RestaurantVoiceLine {
  lineId: string;
  lang: Lang;
  text: string;
}

const LANGS: readonly Lang[] = ['en', 'fr'];

/** `seq.<a>.<b>.<lang>` for every ordered pair, and `countattr.<item>.<color>.<count>.<lang>` for every coloured, counted variant. */
export function restaurantStretchVoiceLines(content: AnimalRestaurantContent): RestaurantVoiceLine[] {
  const out: RestaurantVoiceLine[] = [];
  for (const lang of LANGS) {
    const seq = content.sequenceFrames?.[lang];
    if (seq) {
      for (const a of content.items)
        for (const b of content.items)
          if (a.id !== b.id)
            out.push({ lineId: `seq.${a.id}.${b.id}.${lang}`, lang, text: seq.replace('{a}', a.phrase[lang]).replace('{b}', b.phrase[lang]) });
    }
    const frame = content.countAttributeFrames?.[lang];
    const words = content.countWords?.[lang];
    if (frame && words) {
      for (const item of content.items) {
        if (!item.variants?.every((v) => v.plural)) continue;
        for (const v of item.variants)
          for (const count of ['2', '3'] as const) {
            if (!item.prompts.en[count] || !item.prompts.fr[count]) continue;
            out.push({
              lineId: `countattr.${item.id}.${v.color}.${count}.${lang}`,
              lang,
              text: frame.replace('{count}', words[count]).replace('{items}', v.plural![lang]),
            });
          }
      }
    }
  }
  return out;
}
