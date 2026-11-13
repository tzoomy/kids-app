# Asset and dependency licence policy

## Code dependencies

- Runtime and dev dependencies must be licensed MIT, Apache-2.0, or BSD.
- No new paid services, analytics, or ads (see `AGENTS.md`).

## Art and sound

- Third-party art and sound must be **CC0** or **CC-BY** only. No NC (non-commercial) and no SA (share-alike) licences.
- Assets are bundled locally in the repository. No hotlinking.
- Every CC-BY item needs an entry in `src/content/credits.json` (title, author, source URL, licence, bundled files). The entry is shown in the parent area under Credits. CC0 items may be listed too.
- Main characters are always our own original art.

## Reuse before build

Before coding something new, check whether a free library or asset already does it:

1. Phaser plugins and the existing game templates in this repo.
2. Lottie or Rive animations (only if the licence fits the rules above and no new heavy runtime dependency is needed without approval).
3. CC0 / CC-BY art and sound packs.

If you reuse something, add the credits entry in the same PR.
