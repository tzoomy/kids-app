// Frozen page and region manifest for Colouring Time (docs/specs/leisure-colouring.md).
// Shared by the unit art-contract test and the Chromium art-contract e2e. The implementation
// PR should move this into src/content/games/leisure-colouring.json (AC-09) and import it.
//
// Id changes against the spec table at 34ee9f5 (team-lead decision on review M5, 2026-11-13):
//   - chef-button-top: removed (buttons are outline-only details)
//   - chef-button-bottom: removed (buttons are outline-only details)

export interface ColouringPageSpec {
  id: string;
  /** Coarse (age-2) parts, in z-order. */
  coarse: string[];
  /** Fine (age-5 only) parts as [part, parentPart], in z-order after all coarse parts. */
  fine: Array<[string, string]>;
}

export const COLOURING_PAGES: ColouringPageSpec[] = [
  { id: 'cat', coarse: ['body', 'head', 'ear-left', 'ear-right', 'tail', 'paw-left', 'paw-right', 'cushion'],
    fine: [['ear-inner-left', 'ear-left'], ['ear-inner-right', 'ear-right'], ['muzzle', 'head'], ['belly', 'body'], ['stripe-back', 'body'], ['bow', 'body']] },
  { id: 'dog', coarse: ['body', 'head', 'ear-left', 'ear-right', 'tail', 'paw-left', 'paw-right', 'bone'],
    fine: [['muzzle', 'head'], ['eye-patch', 'head'], ['collar', 'body'], ['belly', 'body'], ['spot-back', 'body']] },
  { id: 'rabbit', coarse: ['body', 'head', 'ear-left', 'ear-right', 'tail', 'paw-left', 'paw-right', 'carrot'],
    fine: [['ear-inner-left', 'ear-left'], ['ear-inner-right', 'ear-right'], ['muzzle', 'head'], ['belly', 'body'], ['carrot-leaves', 'carrot']] },
  { id: 'bear', coarse: ['body', 'head', 'ear-left', 'ear-right', 'arm-left', 'arm-right', 'foot-left', 'foot-right', 'honey-pot'],
    fine: [['ear-inner-left', 'ear-left'], ['ear-inner-right', 'ear-right'], ['muzzle', 'head'], ['belly', 'body'], ['honey-label', 'honey-pot']] },
  { id: 'panda', coarse: ['body', 'head', 'ear-left', 'ear-right', 'arm-left', 'arm-right', 'foot-left', 'foot-right', 'bamboo'],
    fine: [['eye-patch-left', 'head'], ['eye-patch-right', 'head'], ['muzzle', 'head'], ['belly', 'body'], ['bamboo-leaf', 'bamboo']] },
  { id: 'lion', coarse: ['mane', 'head', 'body', 'ear-left', 'ear-right', 'tail', 'paw-left', 'paw-right'],
    fine: [['muzzle', 'head'], ['ear-inner-left', 'ear-left'], ['ear-inner-right', 'ear-right'], ['tail-tuft', 'tail'], ['belly', 'body']] },
  { id: 'butterfly', coarse: ['body', 'head', 'wing-upper-left', 'wing-upper-right', 'wing-lower-left', 'wing-lower-right', 'flower', 'leaf'],
    fine: [['spot-upper-left', 'wing-upper-left'], ['spot-upper-right', 'wing-upper-right'], ['spot-lower-left', 'wing-lower-left'], ['spot-lower-right', 'wing-lower-right'],
      ['band-upper-left', 'wing-upper-left'], ['band-upper-right', 'wing-upper-right'], ['flower-centre', 'flower']] },
  { id: 'chef', coarse: ['hat', 'head', 'jacket', 'arm-left', 'arm-right', 'trousers', 'shoe-left', 'shoe-right', 'pot'],
    fine: [['hat-band', 'hat'], ['apron', 'jacket'], ['scarf', 'jacket'], ['pot-lid', 'pot']] },
];

export interface ColouringRegionSpec { id: string; age2: boolean; parent?: string }

/** Full region ids in document (z-) order: coarse first, then fine. */
export function pageRegions(p: ColouringPageSpec): ColouringRegionSpec[] {
  return [
    ...p.coarse.map((c) => ({ id: `${p.id}-${c}`, age2: true })),
    ...p.fine.map(([f, parent]) => ({ id: `${p.id}-${f}`, age2: false, parent: `${p.id}-${parent}` })),
  ];
}

/** Art-contract thresholds (review B2 on PR #49), in 800x800 viewBox units. */
export const ART_LIMITS = {
  /** Age-2 track: every coarse region's visible area (fine children merged in) holds a disc this wide. */
  coarseDiscMin: 76,
  /** Age-5 track: every region's visible area (coarse rims included) holds a disc this wide. */
  fineDiscMin: 48,
  /** Half the 6-unit outline: subtracted from each visible area before measuring the disc. */
  outlineHalf: 3,
  /** A region boundary pixel must have an outline pixel within this distance. */
  seamTolerance: 3,
};
