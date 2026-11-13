/**
 * Warm, cohesive storybook palette for the Animal Restaurant SVG art set.
 * Designed for high readability at tablet distance, calm backgrounds,
 * and vibrant foreground characters and food items.
 */

export const OUTLINE_HEX = '#3B2A22';
export const OUTLINE_SOFT_HEX = '#5C4338';

export const ART_PALETTE = {
  // Core outlines & neutrals
  outline: '#3B2A22',
  outlineSoft: '#5C4338',
  white: '#FFFDF9',
  cream: '#FFF6E8',
  creamShadow: '#F0DEC2',
  blush: '#FF8FA3',
  blushHighlight: '#FFC2CE',
  eyeDark: '#261710',
  eyeIris: '#6E422C',
  mouthInner: '#9E2A3B',
  tongue: '#FF758F',

  // Animals
  bearBase: '#C87D4B',
  bearShadow: '#A96032',
  bearHighlight: '#E09A6C',
  bearCream: '#FAD9B8',
  bearCreamShadow: '#E5BF98',

  rabbitBase: '#FFF3E2',
  rabbitShadow: '#EBD5B8',
  rabbitHighlight: '#FFFFFF',
  rabbitEarInner: '#FFACC5',
  rabbitEarShadow: '#F28BA8',
  rabbitNose: '#FF758F',

  catBase: '#FFA647',
  catShadow: '#E58426',
  catHighlight: '#FFC278',
  catStripe: '#C96815',
  catCream: '#FFF4E4',
  catEarInner: '#FF9EBB',
  catNose: '#FF6B8B',

  dogBase: '#E8AA6B',
  dogShadow: '#C9894B',
  dogHighlight: '#F7C48E',
  dogPatch: '#8C5230',
  dogPatchShadow: '#6E3D20',
  dogPatchHighlight: '#A86B43',
  dogCream: '#FFF2DE',

  pandaBase: '#FFFBF5',
  pandaShadow: '#E5DDD0',
  pandaHighlight: '#FFFFFF',
  pandaDark: '#3D3532',
  pandaDarkShadow: '#282220',
  pandaDarkHighlight: '#594E4A',
  pandaEarInner: '#FF9EBB',

  lionBase: '#FFBF47',
  lionShadow: '#E29E26',
  lionHighlight: '#FFD87A',
  lionMane: '#D4622A',
  lionManeShadow: '#B04816',
  lionManeHighlight: '#EB8149',
  lionCream: '#FFF2D6',
  lionNose: '#5C3422',

  // Foods
  appleRed: '#F24C4C',
  appleShadow: '#CC3333',
  appleHighlight: '#FF8585',
  bananaYellow: '#FFD43B',
  bananaShadow: '#EAA814',
  bananaHighlight: '#FFF2A6',
  carrotOrange: '#FF8533',
  carrotShadow: '#E06316',
  carrotHighlight: '#FFB380',
  grapesPurple: '#9B5DE5',
  grapesShadow: '#7538C2',
  grapesHighlight: '#C79EFF',
  cheeseYellow: '#FFCA3A',
  cheeseTop: '#FFE073',
  cheeseShadow: '#E8A317',
  cheeseHole: '#D98A0F',
  strawberryRed: '#F9415A',
  strawberryShadow: '#D1233D',
  strawberryHighlight: '#FF8FA0',
  strawberrySeed: '#FFE57F',
  leafGreen: '#57C457',
  leafShadow: '#3CA33C',
  leafHighlight: '#8AE07E',
  broccoliStalk: '#9FD984',
  broccoliStalkShadow: '#7BB862',
  cookieBrown: '#D99B56',
  cookieShadow: '#B87835',
  cookieHighlight: '#F0B97A',
  cookieChip: '#52321E',
  eggWhite: '#FFFDF9',
  eggShadow: '#E6DFD3',
  eggYolk: '#FFB703',
  eggYolkShadow: '#E89600',
  pearGreen: '#A7E048',
  pearShadow: '#7FB828',
  pearHighlight: '#CFF27E',
  orangeCitrus: '#FF922B',
  orangeShadow: '#E06D0B',
  orangeHighlight: '#FFC078',
  fishBlue: '#4D96FF',
  fishShadow: '#2B6FD6',
  fishHighlight: '#8CC0FF',
  fishBelly: '#D6EAFF',
  stemBrown: '#7A4B2A',

  // Props & Scene
  plateRim: '#FFFBF2',
  plateWell: '#F3E9D8',
  plateWellShadow: '#E2D4BE',
  plateAccent: '#F4A261',
  wallUpper: '#FFF3E0',
  wallLower: '#F7DEC0',
  wallTrim: '#E5BE94',
  sceneOutline: '#7A5C48',
  windowSky: '#B8E6FF',
  windowHill: '#98D886',
  awningRed: '#EE6C62',
  awningCream: '#FFF8EE',
  counterTop: '#FFF6E6',
  counterTopShadow: '#EAD7B8',
  counterWood: '#B87D56',
  counterWoodDark: '#9E6540',
  counterWoodLight: '#CC926B',
  floorWood: '#D9A06B',
  floorPlankLine: '#C08552',
  lampGold: '#FFD166',
  lampGlow: '#FFF3B0',

  // FX
  starGold: '#FFD43B',
  starShadow: '#F59F00',
  heartPink: '#FF5C77',
  heartShadow: '#E03E5B',

  // Number Garden / Sorting Beds
  soil: '#C9894B',
  soilShadow: '#8C5230',
  soilHighlight: '#E8AA6B',
  gardenPath: '#F0DEC2',

  // Language House / Travel Suitcase
  caseLeather: '#D4622A',
  caseLeatherShadow: '#B04816',
  caseLeatherHighlight: '#EB8149',
  caseCream: '#FFF2D6',
  caseLining: '#F7DEC0',
  // Who's Hiding? / Kitchen Orchestra (reused names for the new worlds)
  bushBerry: '#E03E5B',
} as const;

export type ArtPaletteKey = keyof typeof ART_PALETTE;
export default ART_PALETTE;
