import { ANIMAL_KINDS } from '../../assets/vectorArt';

// Kept outside RestaurantScene so the ?e2e=1 hook `seedRestaurantKind` (installed by createGame) is synchronous
// while RestaurantScene itself is a lazily loaded chunk.

/** ?e2e=1 seed (hook `seedRestaurantKind`): the next customer is this kind, once; then the random pick resumes. */
let seededKind: string | undefined;

export function seedRestaurantKind(kind: string): void {
  seededKind = ANIMAL_KINDS.includes(kind) ? kind : undefined;
}

export function takeSeededRestaurantKind(): string | undefined {
  const kind = seededKind;
  seededKind = undefined;
  return kind;
}
