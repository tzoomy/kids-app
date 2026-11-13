# Pending decisions

Reversible defaults taken in continuous-development mode, awaiting Maor's confirmation or change. Each bullet names its branch; a decision that Maor resolves moves into the relevant spec as a `**Decided by the owner (YYYY-MM-DD):**` item.

- Who Lives Here? (feat/who-lives-here): Nature Lab's building now opens a two-card game picker (Who's Hiding? first, Who Lives Here? second) instead of opening Who's Hiding? directly; `entryGameId` stays `who-is-hiding`. To revert, drop the `nature-lab` branch in `src/worlds/MapScene.ts`.
- Who Lives Here? (feat/who-lives-here): Pass 1 uses the six homes and animals that already have approved art (pond/frog, nest/bird, tree hollow/owl, burrow/rabbit, doghouse/dog, beehive/bee) with one animal per home, instead of the farm / sea / jungle / sky set from the idea text. More habitats and several animals per home need new art (Pass 2) and are content-only changes.
- Who Lives Here? (feat/who-lives-here): Age 2 starts at level 1 and is capped at level 4 (three homes, no riddles); age 5 starts at level 5 and may drop to level 3.
- Who Lives Here? (feat/who-lives-here): A round is always 3 animals (the engine's `trialsPerRound`); at 2 homes the third animal is a repeat of the first, never twice in a row.
- Who Lives Here? (feat/who-lives-here): A wrong tap never fails: the animal tilts "hmm", the right home pulses and a warm Hebrew retry line plays, at both ages; the descriptive clue after a miss starts at level 5 (age 5 only in practice).
- Who Lives Here? (feat/who-lives-here): Built as a separate `HabitatScene` that reuses the Sorting Beds layout, trial tracker, wrong-tap lock and motion helpers and the shared adaptive engine, instead of refactoring `SortingScene` into a generic engine, so Sorting Beds stays untouched and its tests unchanged.
- Who Lives Here? (feat/who-lives-here): Animal and home names and clues are voiced in English or French through device TTS (Pass 1) and not drawn as text; the only on-screen text is the Hebrew prompt bubble. Recorded Leda clips are Pass 2.
- Who Lives Here? (feat/who-lives-here): The Nature Lab picker cards use existing scene backgrounds as placeholder art (`art/scenes/hiding/bg-landscape.svg`, `art/scenes/habitats/bg-landscape.svg`); real card art is Pass 2.
