/** Shared warm, saturated palette for all procedural vector art in the app. */
export const PALETTE: Record<string, number> = {
  red: 0xe2554f,
  yellow: 0xffd93d,
  orange: 0xff9f43,
  purple: 0x9b5de5,
  green: 0x6bcb77,
  brown: 0xa97155,
  white: 0xfef6e4,
  blue: 0x4d96ff,
  pink: 0xff6fb5,
  teal: 0x4ecdc4,
  cream: 0xfff3d6,
  outline: 0x33302a,
};

export function colorOf(name: string): number {
  return PALETTE[name] ?? 0x888888;
}
