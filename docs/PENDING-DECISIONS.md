# Pending Maor decisions

Open questions where an agent took a reversible default so work could continue. Each entry names the default, where it was applied, and how to reverse it. Maor confirms or overrides; resolved entries move to the relevant spec.

| Date | Topic | Default taken | Where | How to reverse |
|---|---|---|---|---|
| 2026-11-13 | Kitchen Orchestra world in `docs/WORLDS.md` | The code (and the 2026-11-12 decision in `docs/specs/kitchen-orchestra.md`) places Kitchen Orchestra in **Language House** via the game picker; `docs/WORLDS.md` still listed it under Art Studio. Docs were aligned to the code; no code changed. Please confirm Language House is still the intended world. | `docs/WORLDS.md` (Language House §6), `docs/specs/kitchen-orchestra.md` | Revert the docs PR; moving the game back to Art Studio would be a separate code change (content `world`, `worlds.json` entry game, picker, skill-key migration). |
| 2026-11-13 | Science World placement | **Separate map area** (not part of Nature Lab). Potion Lab, Sink or Float and Magic Magnet are listed under Science World. | `docs/WORLDS.md` (owner-approved ideas list, main-map table, Science World section) | Fold the three games into Nature Lab in `docs/WORLDS.md` and drop the Science World row/section; no code depends on it yet. |
