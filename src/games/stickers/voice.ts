// Sticker Board Hebrew voice lines (Pass 1: device TTS only). Feminine singular Hebrew.
import type { SpeechRequest } from '../../core/audio/types';

export const STICKER_VOICE = {
  intro: {
    lineId: 'sticker-board.intro.he',
    lang: 'he',
    text: 'לוח מדבקות! בחרי מדבקה, ואפשר גם לצייר באצבע.',
  },
  help: {
    lineId: 'sticker-board.help.he',
    lang: 'he',
    text: 'לחצי על מדבקה כדי לשים אותה על הלוח, וגררי אותה למקום. גררי אצבע על הלוח כדי לצייר.',
  },
  praise: {
    lineId: 'sticker-board.praise.he',
    lang: 'he',
    text: 'כל הכבוד!',
  },
  saved: {
    lineId: 'sticker-board.saved.he',
    lang: 'he',
    text: 'שמרנו באלבום!',
  },
} as const satisfies Record<string, SpeechRequest>;
