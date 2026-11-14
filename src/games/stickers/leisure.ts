// Pure leisure mode resolver for Sticker Board (AC-13).
// Free-creation Art Studio: either earns through LearningSession when enabled, or neither earns nor spends.

export type StickerLeisureMode = 'earn' | 'none';

export function stickerLeisureMode(earnsLeisure: boolean, timeEarningEnabled: boolean): StickerLeisureMode {
  return earnsLeisure && timeEarningEnabled ? 'earn' : 'none';
}
