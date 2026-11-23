// Colouring Time voice lines (Pass 1: device TTS only; no audio-manifest rows). Feminine singular Hebrew.
import type { SpeechRequest } from '../../core/audio/types';

export const COLOURING_VOICE = {
  intro: { lineId: 'colouring.intro.he', lang: 'he', text: 'זמן צביעה! בחרי צבע ולחצי על הציור.' },
  help: {
    lineId: 'colouring.help.he',
    lang: 'he',
    text: 'בחרי צבע, ואז לחצי על חלק בציור כדי לצבוע אותו. אפשר לבטל, לנקות ולעבור לדף הבא. הציור נשמר.',
  },
  end: { lineId: 'colouring.end.he', lang: 'he', text: 'זמן הצביעה נגמר. הציור שלך שמור. נתראה בפעם הבאה!' },
  // Spec/AC-10 request this un-prefixed id. Since #103 the audio manifest maps it to the
  // he.bubbles.lowWarning clip (same text), so it plays the recorded Leda clip.
  lowWarning: { lineId: 'bubbles.lowWarning', lang: 'he', text: 'עוד קצת זמן!' },
} as const satisfies Record<string, SpeechRequest>;
