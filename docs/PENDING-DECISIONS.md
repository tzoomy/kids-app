# Pending decisions

Reversible defaults taken by an implementer while a decision is still open. Each entry names the PR or feature, the default taken, and the alternatives, so Maor can confirm or change it. Nothing here is approved until Maor says so; when he decides, move the item into the spec as **Decided by the owner (YYYY-MM-DD):** and delete the entry here.

## station-trail (spec: `docs/specs/station-trail.md`)

1. **What counts as "completed" (the star).**
   - Default: the profile has played one full round (`trialsPerRound` trials across all languages), or any language's level is above the age track's start level. Read from the stored adaptive skills; nothing new is persisted.
   - Alternatives: reaching a mastery level; any single trial; a per-game "all items in the mastered box" rule.
2. **Suggested next game.**
   - Default: the first uncompleted station in trail order. The adaptive engine has no cross-game suggestion API, so none is used.
   - Alternative: a new engine API that ranks games by level, due items, or recent misses.
3. **Suggestion when every game is completed.**
   - Default: the least recently played game (oldest `lastPlayedDay`, ties by trail order), so the pulse rotates.
   - Alternatives: always the first station; no pulse at all.
4. **One-game worlds.**
   - Default: a world with exactly one game keeps direct entry (Number Garden, Nature Lab); the trail picker appears when a world has 2 or more games (Language House today).
   - Alternative: always show a one-station trail.
5. **Leisure Corner.**
   - Default: its picker has no trail (leisure games are free play, no progress state).
   - Alternative: a trail there too.
6. **Hebrew card names for Sorting Beds and Who's Hiding?** (`gamePicker.sortingBeds` = "ערוגות המיון", `gamePicker.whoIsHiding` = "מי מתחבא?" in `he.json`; used only once those worlds get a second game).
   - Default: the sorting name from `docs/specs/sorting-beds.md`; the hiding name is a placeholder.
   - Alternative: Maor's wording.
7. **Placeholder visuals.** CSS star badge, CSS pulse ring and dotted trail line; Sorting Beds and Who's Hiding? cards reuse existing scene backgrounds. Polished art is Pass 2.
