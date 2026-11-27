// `?level=20` boots straight into Workshop L20 (preview route); without it the app boots exactly as before (AC-10, AC-11).
import { describe, expect, it } from 'vitest';
import { bootTarget, parsePreviewRoute } from '../../src/game/previewRoute';

describe('workshop L20 preview route', () => {
  it('[AC-10] ?level=20 selects the L20 scene, with or without other params', () => {
    expect(parsePreviewRoute('?level=20', '')).toEqual({ level: 20, scene: 'WorkshopL20Scene' });
    expect(parsePreviewRoute('?e2e=1&level=20', '')).toEqual({ level: 20, scene: 'WorkshopL20Scene' });
    expect(bootTarget('?level=20', '')).toBe('workshop-l20');
  });

  it('[AC-10] #/workshop/20 is accepted too', () => {
    expect(parsePreviewRoute('', '#/workshop/20')).toEqual({ level: 20, scene: 'WorkshopL20Scene' });
  });

  it('[AC-11] default boot is unchanged: no param, other params and other values never select a preview', () => {
    for (const [search, hash] of [['', ''], ['?e2e=1', ''], ['?level=', ''], ['?level=19', ''], ['?level=2', ''], ['?level=200', ''], ['?level=20x', ''], ['?level=abc', ''], ['?Level=20', ''], ['', '#/workshop/19'], ['', '#something']]) {
      expect(parsePreviewRoute(search, hash), `${search}${hash}`).toBeNull();
      expect(bootTarget(search, hash), `${search}${hash}`).toBe('profile-select');
    }
  });
});
