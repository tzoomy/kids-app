# Two adaptive games per world: research synthesis

Status: **research proposal, pending owner approval.** Nothing here is built yet, and no app code changes in this PR. Owner direction (2026-11-11): build the remaining worlds quickly with device voice and basic animation to test each idea. Polish a world (animation plus Gemini voice) only after it proves itself. Every game must adapt its difficulty to the child's answers.

How this was made: three researchers worked separately from the same brief (`raw/brief.md`).
- **Grok Bot** (team lead), using web research.
- **Claude**: Claude Code, `claude-opus-5-5`, with web search. Raw output in `raw/claude-games.md`.
- **Gemini**: Antigravity CLI, `gemini-4-argon-high`. Raw output in `raw/gemini-games.md`.

This document picks the best two games per world. It notes where the researchers agreed or disagreed, and lists strong alternates. Every URL under Sources was checked on 2026-11-11, and the citations that failed are listed under "Citation check".

---

## 1. Worlds in scope

From `docs/WORLDS.md`, leaving out the Leisure Corner, which spends balance and doesn't earn it:

| World | Existing | Picked here |
|---|---|---|
| Language House | Animal Restaurant (choice/serve) | Adaptive upgrade notes + 2 new games |
| Number Garden | none | 2 games |
| Nature Lab | none | 2 games |
| Art Studio | Bubbles only (that's the Leisure Corner) | 2 games |

---

## 2. What the evidence says, and the design rules it implies

| Finding | Source | Rule for us |
|---|---|---|
| Apps teach best when they are active, engaged (not distracting), meaningful, and social, around a clear learning goal. Decorative "hotspots" hurt learning. | Hirsh-Pasek et al. 2015 | Every tap acts on the target word. No decorative tap toys inside the learning games. |
| Toddlers (24–30 months) learned a word from touchscreen video only when they had to tap the *specific* labeled object. Tapping anywhere didn't help. Specific tapping slightly *disrupted* learning for children aged 30–36 months. | Kirkorian et al. 2016 | Age 2: the child's tap must be on the referent. Age 5: fewer forced taps during listening. |
| A word-learning app produced vocabulary gains in 2-year-olds. | Walter-Laager et al. 2017 | Picture + audio + touch matching is a valid core for age 2. |
| Only about 30–36% of 2-year-olds managed drag-and-drop. Tap completion was 98.7% for ages 3–6, and drag accuracy improves from 3 to 6. | Abdul Aziz et al. 2014; Vatavu et al. 2015 | **Age 2: tap-to-place everywhere** (tap the item and it flies to its spot). Real drag only on the age-5 track. |
| Spaced, repeated retrieval beat repeated study and immediate retrieval for preschool word learning, including generalization to new pictures. Expanding schedules added no lasting benefit over equal spacing after a week. | Leonard et al. 2019, 2020, 2022, 2024; Haebig et al. 2021 | Bring missed words back 2–3 items later and again next session. Use simple Leitner boxes and don't over-tune the schedule. |
| 2-year-olds remembered novel words best after 15 minutes when learning instances were *spaced*, even though in-session retrieval was harder. | Vlach, Ankowski & Sandhofer 2012 | Interleave words within a round and don't mass one word. In-session errors are acceptable. |
| TPR (acting words out) and songs each helped preschool L2 vocabulary in small studies, and combined they helped most. Systematic reviews call the song evidence weak. | Thai TESOL 2022; Cochrane review (L2 vocab up to age 6) | Use action words (body, verbs) and short chants, but treat songs as a carrier, not the method. |
| Learning is fastest around 85% accuracy (formal result for simple learners). A 3-up/1-down staircase converges near 80%. | Wilson et al. 2019; 3C Platform docs | Age 5 target ≈ 75–85% first-try correct. Age 2 target ≈ 90%, near-errorless. |
| Khan Academy Kids moves a child on fast once a topic is mastered, and gives more basic lessons "with additional scaffolding" when she struggles. Lingokids starts from an age band and nudges difficulty up as skills grow. | KA Kids help center; Lingokids help center | Age only sets the *starting* level. Track mastery per skill and per language (EN and FR separately). |
| Sago Mini designs with no failure state and lets children make their own goals. | Sago Mini letter to parents | No fail screens. A wrong answer gets a funny, gentle reaction and another try. |
| By 2, most children point to things in a book when asked and point to body parts. By 5, they count to 10 and recognize simple rhymes. | CDC milestones | Body-part and point-to-picture tasks suit age 2. Counting to 10 and rhymes suit age 5. |

---

## 3. Shared conventions (all three researchers agree)

- **Age-2 track:** 1–2 targets, tap-to-place, huge targets. After a miss the wrong item wiggles back and the right one glows. An automatic hint plays after about 5–6 s. Level changes happen only between rounds.
- **Age-5 track:** 3–6 choices, real drag, multi-step requests, attributes, rule switches.
- **Signals:** correct on first try, number of tries, hints used (replay, glow, demonstration), response time, and quitting mid-round.
- **Levers:** number of choices, how similar the distractors are, item set (new vs. known words), request complexity (noun → attribute/quantity → two-step → negation), picture support (picture + audio → audio only → descriptive clue), and speed.
- **Leisure stays separate:** earning depends on participation time, never on level or accuracy. This is already a requirement in `ARCHITECTURE.md` §7.

---

## 4. Chosen games

Credit key: **C** = Claude, **G** = Gemini, **B** = Grok Bot.

### 4.1 Language House

**Animal Restaurant: adaptive upgrade notes** (C and G proposed nearly the same ladder)
- **Levels:**
  - L1: 2 very different foods.
  - L2: 3 plates.
  - L3: 3–4 plates with similar distractors (apple, tomato, strawberry).
  - L4: quantity.
  - L5: attribute ("the green apple").
  - L6: two-item order.
  - L7: audio-first (plates appear after the animal finishes speaking).
- **Up:** 3 first-try correct with no hint. **Down:** 2 misses in the last 3, or an auto-demonstration. The next item after a step down is a well-known word.
- **Language:** the same food is tracked per language (`food.apple.en` / `food.apple.fr`). The parent can start French one level higher.

#### Game A: Travel Suitcase (מזוודת הטיול) — proposed by **C, G and B** (unanimous)
- **Mechanic:** A character packing for a trip (beach, snow, picnic) asks in EN/FR, "Put the hat in the suitcase!" The child puts the item in, the suitcase snaps shut, and a short trip animation plays.
- **Teaches:** clothes and everyday objects (hat/chapeau, shoes/chaussures, coat/manteau, ball/ballon), "put the…", and later colours, numbers and negation.
- **Age 2:** 1 of 2 items, tap-to-pack. The character tries the item on.
- **Age 5:** 3–5 items on the shelf, real drag, "the blue hat", two-item requests. At the top level, negation: "not the red one" / "pas le rouge".
- **Adaptive rules:**
  - Ladder: shelf 2→3→4→5. Then distractors in the same category, then the same item in different colours. Then 1→2→3 items per request. Then attribute, then negation, then audio only.
  - **Up:** 3 first-try correct in a row. **Down:** 2 misses in a row, or 2 wrong drops / 2 replays on one request.
  - Age 5 only: a median response time under about 3 s at ≥85% accuracy may skip a level (C).
- **Inspired by:** Sago Mini (getting ready to play), Lingokids (topic word groups), TPR.
- **Effort:** S once sort/drag exists. **Template:** sort/drag with one drop zone, which makes it the ideal first sort/drag game.

#### Game B: Puppet Says (הבובה אומרת) — proposed by **C and B**; Gemini's song mechanic is merged in
- **Mechanic:** A friendly puppet gives a command or sings a short line: "Touch your nose!", "Clap!", "Jump!". The child taps the body part or action card, and the puppet does it with a silly animation. The child is invited, not required, to copy it in real life (on-screen TPR).
- **Teaches:** body parts and action verbs (nose/nez, ears/oreilles, jump/saute, clap/tape des mains).
- **Age 2:** tap 1 of 2 highlighted body parts on a big puppet. Always ends with a little dance. Good for playing together with a parent.
- **Age 5:** 3–6 choices, verb + body part ("wave your hand"). Then two-step commands tapped in order. Then a sung line with a missing final word, chosen from props (G's "Word Song Stage" cloze).
- **Adaptive rules:**
  - Ladder: spots 2→6. Then neighbouring body parts as distractors (eyes and ears; hand and arm). Then nouns → verbs → 2-step sequences → sung cloze. Then song tempo.
  - **Up:** 3 first-try correct in a row. **Down:** 2 misses in a row. The missed word is replayed alone with a spotlight on the correct spot.
  - Pairs that get confused often come back together next session.
- **Inspired by:** Lingokids (songs, recurring characters), TPR studies.
- **Effort:** M (puppet animation set). **Template:** choice/serve (hotspots instead of plates) plus a small "ordered steps" extension, shared with Kitchen Orchestra.

**Disagreement and alternate:** G's second game was **Word Song Stage** (S, choice/serve): tap the prop matching the sung word at the musical pause. C and B preferred Puppet Says because the TPR evidence is stronger, it uses CDC-appropriate body-part pointing at age 2, and the actions are fun to copy. Word Song's mechanic survives as Puppet Says' top age-5 level, so nothing is lost.

### 4.2 Number Garden (Hebrew instructions; EN/FR counting is an optional, separate skill)

#### Game A: Picnic Train (רכבת הפיקניק) — **C and G** (and the existing WORLDS.md P2 pick)
- **Mechanic:** Animal passengers are each missing something (a hat, an apple). The child hands items out one-to-one, the whistle blows, and the train leaves.
- **Teaches:** one-to-one matching, counting 1–10, "how many are missing?", and equal sharing (age 5). Optionally, number words in EN/FR spoken as each item lands.
- **Age 2:** 2–3 passengers, tap an item and it flies to the next empty seat. No numerals.
- **Age 5:** "The train needs 7 apples, 4 are already here." She adds 3, or picks a number tile. Later, she shares items equally between 2 carriages, with a "Depart" check button.
- **Adaptive rules:**
  - Ladder: set size 2→3→5→7→10. Then ghost outline slots → no outlines. Then neat rows → scattered layout. Then matching → counting the total → missing addend.
  - **Up:** 3 trains sent off with the right count. **Down:** 2 wrong whistle checks or 2 hints. Outlines come back and the range drops.
  - Age 5: if she counts correctly but slowly, stay on the level and add dot-card hints rather than going up (C).
- **Inspired by:** Khan Academy Kids (quantity in context), DragonBox Numbers (quantity before numerals), Sago Mini (travel world).
- **Effort:** S–M. **Template:** sort/drag with several targets and a slot counter.

#### Game B: Sorting Beds (ערוגות המיון) — **G** (B agrees)
- **Mechanic:** Flowers, leaves and vegetables have tumbled onto the path. The child sorts them back into 2–3 beds by colour, shape or size, and each bed blooms when it is full.
- **Teaches:** sorting by one attribute, then by two, and flexible thinking (a rule that switches mid-round). Optionally, colour and size words in EN/FR (big/grand, small/petit).
- **Age 2:** 2 beds and 1 obvious attribute (red vs. yellow), tap-to-place. A wrong bed "shakes its head" and points to the right one (Montessori control of error).
- **Age 5:** 2–3 beds with two attributes ("small red"), or a playful rule switch: "Now the mole wants them by SIZE!"
- **Adaptive rules:**
  - Ladder: beds 2→3. Then 1 attribute → 2 attributes → rule switch. Bed labels go from an explicit picture → an abstract symbol → a spoken rule only.
  - **Up:** 4 items sorted correctly in a row (age 5: under about 3.5 s per item). **Down:** 2 wrong sorts in a row. The matching bed is highlighted and the game returns to one attribute.
- **Inspired by:** Montessori sorting materials and apps, Tiger eAcademy (short task with a clear rule), and the "messy shop" idea in the vision.
- **Effort:** S. **Template:** pure sort/drag.

**Disagreement and alternate:** C's second game was **Garden Scales** (M): a seesaw where the child balances or reaches a target, for more/less/same and ways to make a number. It teaches deeper maths, but it needs seesaw physics. Sorting Beds is cheaper, gives the sort/drag template a second game straight away, and still gives the 2-year-old a meaningful task. **Strong alternate:** build Garden Scales once the girls have validated Number Garden.

### 4.3 Nature Lab

#### Game A: Who Lives Here? (מי גר כאן?) — **C and G** (and WORLDS.md)
- **Mechanic:** A lost animal appears. The child sends it home (nest, pond, cave, tree, hive), and the home lights up with a family reunion animation. The animal is named in HE and EN/FR.
- **Teaches:** animal names (bird/oiseau, fish/poisson, frog/grenouille), where animals live, and simple descriptions ("I live in the water" / "Je vis dans l'eau").
- **Age 2:** 2 animals and 2 very different homes, tap-to-place. The animal makes its signature sound.
- **Age 5:** 3–4 homes. A spoken riddle replaces the picture ("I have feathers and I sleep in a tree"). Later, animals with two possible homes, or footprints to match.
- **Adaptive rules:**
  - Ladder: homes 2→4. Clues go picture → name only → riddle (audio only). Distractor homes go from very different → similar (pond vs. sea). New animals come in at about 1 new to 3 known.
  - **Up:** 3 correct in a row without the magnifier hint. **Down:** 2 misses. A "peek" animation plays inside the right home and the number of homes drops. A riddle that needed 2 or more replays counts as half-correct (C).
- **Inspired by:** Sago Mini (calm, responsive world), Gus on the Go (animal word themes), Khan Academy Kids (animal books).
- **Effort:** S. **Template:** sort/drag (choice/serve also works).

#### Game B: Who's Hiding? (מי מתחבא?) — **C and B**
- **Mechanic:** Bushes rustle because an animal is hiding. The child hears a sound, a name or a clue and taps the right bush. The animal pops out ("Coucou!") with a funny reaction.
- **Teaches:** animal names and sounds, and describing words (big/grand, small/petit, stripes/rayures, long tail).
- **Age 2:** 2 bushes, with an ear or tail clearly sticking out. The animal's sound plays together with its name.
- **Age 5:** 3–5 bushes. First the name alone, then only a clue ("it's small and has a long tail"), then two clues combined.
- **Adaptive rules:**
  - Main lever: **how much of the animal shows** (half → only a tail → nothing, audio only). Then the number of bushes. Then sound + name → name → clue. Then animals that look or sound alike (cat vs. tiger).
  - **Up:** 3 correct in a row. **Down:** 2 misses. Each hint (a replayed rustle) reveals more of the animal and is logged.
- **Inspired by:** the Gus on the Go farm lesson (hidden animals behind barn doors), Khan Academy Kids (short concrete science), Tiger eAcademy (short spoken tasks).
- **Effort:** S. **Template:** choice/serve (bushes instead of plates). **This is the cheapest way to open a new world.**

**Disagreement and alternate:** G's second game was **Weather in the Window** (M, choice/serve): weather switches and dressing the character, moving up to prediction and two-step cause and effect. It is the better *science* game, but it needs several weather-state animations, which conflicts with "basic animation first". Its free-play part also gives the 2-year-old little to adapt. **Strong alternate** for the Nature Lab polish phase.

### 4.4 Art Studio

#### Game A: Color the World (צובעים את העולם) — **C and G** (and WORLDS.md)
- **Mechanic:** Colour a scene from the map with big tap-to-fill areas. Sometimes the studio character asks for something specific ("Colour the apple red!" / "Colorie la pomme en rouge !"). Finished pictures go into a local album.
- **Teaches:** colour and object names in EN/FR, following a direction, and at higher levels shades and colour mixing (red + yellow = orange).
- **Age 2:** free filling with 3–4 big crayons, each colour named aloud when tapped. Optional "Find the red one!" with 2 crayons. Going outside the lines is never a mistake.
- **Age 5:** requests climb a ladder: colour only → colour + object → small/big + colour → shades (bleu clair) → mixing two pots. Requests alternate with free colouring.
- **Adaptive rules:** these apply only to request turns. Free colouring is never scored.
  - Ladder: palette 2→4→6→8. Then close colours (orange vs. red, pink vs. purple). Then request complexity. Then audio only (the colour dot under the request is removed).
  - **Up:** 3 correct requests in a row. **Down:** 2 wrong pot taps. The target pot bubbles and its name is repeated.
  - At most 1 request per about 3 fills, so it still feels like colouring.
- **Inspired by:** Sago Mini and Khan Academy Kids (making things inside the world).
- **Effort:** M.
- **Template disagreement:** C proposed a new **create/fill** template with flood-fill and an album. G proposed a **choice/serve extension** with pre-cut sprite regions that get tinted (select pot → tap region). **Decision for the basic version: G's region-tint approach**, because it reuses choice/serve and is cheaper. Flood-fill and the album can come with polish, and the Leisure Corner can reuse them later.

#### Game B: Kitchen Orchestra (תזמורת המטבח) — **C and G** (and WORLDS.md)
- **Mechanic:** Pots, a xylophone made of glasses, and a pan drum. In free play the child makes music. In guided mode the chef plays a short pattern and the child echoes it, or the chef calls out an instrument in EN/FR ("Play the drum!" / "Joue du tambour !"), and the whole kitchen dances.
- **Teaches:** cause and effect, listening, short sequence memory, instrument and kitchen words in EN/FR, and sound attributes (fast/vite, loud, slow).
- **Age 2:** 2–3 big instruments, free play with no failure. Optional "Tap the bell!" with the target glowing.
- **Age 5:** 4–6 instruments. Echo sequences of 2→5 notes, plus requests like "Touche le verre deux fois !"
- **Adaptive rules:**
  - Ladder: sequence length 1→5. Then playback speed. Then visual support: instruments stay lit with number badges → brief flash → sound only → spoken names only. Then instruments 3→6.
  - **Up:** 2 perfect echoes in a row (C; G said 3; we use 2 because sequences are long trials). **Down:** 2 failures. The same pattern replays 25% slower with lights on as a free hint, and the sequence gets 1 note shorter.
- **Inspired by:** Sago Mini / Pok Pok (toy-like play), the classic Simon game, Tiger eAcademy (short guided sequence).
- **Effort:** S–M (audio timing). **Template:** choice/serve plus the same "ordered steps" extension as Puppet Says.

---

## 5. Build order (recommendation)

The goal is to open **one playable game in every world as early as possible**, with device voice and basic tweens, so the girls can show us which worlds they love. Second games come after.

1. **Shared adaptive engine** (spec below), then retrofit **Animal Restaurant** onto it. This proves the engine on a game they already know. *(M)*
2. **Who's Hiding?** opens the Nature Lab. choice/serve, *(S)*.
3. **Kitchen Orchestra**, with the ordered-steps extension, opens the Art Studio. *(S–M)*
4. **The sort/drag template** (with tap-to-place for age 2) + **Sorting Beds** opens the Number Garden. *(M + S)*
5. Second games on existing templates: **Travel Suitcase**, **Who Lives Here?**, **Picnic Train**. *(S each)*
6. **Puppet Says** (reuses ordered steps) and **Color the World** (region-tint). *(M each)*
7. Strong alternates if a world is a hit: **Garden Scales**, **Weather in the Window**, **Word Song Stage**.

After each step, note which games the girls *choose* during free time. That is the enjoyment measure, and it should reorder this list. Claude's raw output says the same.

---

## 6. Shared adaptive-difficulty engine (spec sketch)

A pure TypeScript module at `src/core/adaptive/`, with no Phaser dependency and Vitest coverage, next to `core/leisure` and `core/storage`. All three researchers converged on this shape.

- **Storage:** one key per child, `localStorage["adapt.v1.<profileId>"]`, with a schema version and a migration path like other storage. It is written after every round and included in any future parent export.
  - `skills["<world>.<game>.<lang>"] = { level, streak, missStreak, window: last 8 outcomes, lastPlayed }`. Each language gets its own skill, so EN and FR never share a level.
  - `items["<lang>.<wordId>"] = { box: 1–5, due, seen, firstTryCorrect }`.
- **Event per trial:** `recordAttempt({ skillId, lang, itemId, correct, firstTry, hints, rtMs })`. Scoring: 1.0 = first try with no hint, 0.5 = correct after a hint or retry, 0 = wrong.
- **Default ladder rules** (each game's JSON can override them):
  - **Up:** 3 first-try correct in a row, or ≥85% over the window.
  - **Down:** 2 misses in a row (or 2 in the last 3), any auto-demonstration, or <60% over the window.
  - At most one level per round.
  - **Age 2** changes level only between rounds and **ignores response time**, because it is too noisy at that age. This follows C. G proposed a 6 s threshold, which we rejected for age 2.
  - **Age 5** may use response time only to *skip ahead*, never to demote.
- **Spaced retrieval (Leitner):**
  - Correct moves an item up a box. A miss moves it to box 1 and brings it back 2–3 items later in the same session.
  - Review times: box 2 = next session, box 3 = 2 days, box 4 = 4 days, box 5 = 1 week.
  - Each round is built from due items first, then about 1 new item for every 3 known. Equal spacing is fine (Leonard 2024).
- **Frustration guard:** 3 misses in a round, or quitting mid-round, makes the next round a "confidence round" with familiar items, 1–2 levels down, before climbing back. There is never a fail screen.
- **Starting point and decay:**
  - The starting level comes from the age profile (age 2 → L1, age 5 → L3).
  - The parent can start French higher.
  - After more than 14 days without play, start one level lower.
  - The parent area shows each skill's level and can override it.
- **Content contract:** each game's JSON declares `levels[]` with the lever values (choice count, distractor group, support mode, set size, request type). The engine only picks the level index and the item IDs, and the templates render them.
- **Separate from leisure:** the engine never touches leisure earning. Level and accuracy don't change credit. The engine also mixes due and new items into a favourite game, which handles the vision's "no unlimited farming of the same easy stage" rule without forbidding replay.

---

## 7. Citation check (what was dropped or corrected)

All URLs below were opened with curl, WebFetch or the Crossref/DOI/PMC APIs on 2026-11-11.
- **Gemini:** the 2022 Leonard et al. paper had a **non-resolving DOI** (`10.1177/23969415221088926`) and a **wrong PMC link** (PMC8978184 is an ophthalmology paper). Replaced with the correct record, PMC9629778.
- **Gemini:** it attributed "~27% of 2-year-olds tap precisely" to Abdul Aziz et al. 2014. That paper reports 30–36% for **drag-and-drop** at age 2. Corrected in this synthesis.
- **Gemini:** "Lingokids scales distractor count and recycles missed vocabulary across games" is not supported by Lingokids' public pages, which say only that difficulty adapts by age band and skills. It is treated as Gemini's inference.
- **Claude:** dropped arXiv 2402.01669, which is an intelligent-tutoring paper and not the DDA review it was cited as. Also dropped a generic Cool Mom Tech page, an Easter Seals page that returns an error, `educators.lingokids.com/methodology` (server error), and a DOAJ record that could not be opened. The Nacher et al. PDF link was replaced by its DOI.
- **Claude:** the Lingokids article ID it cited is real, but the page now shows "What Are the Sections?". It was replaced by the Lingokids methodology and level articles.
- The raw files are kept unedited for transparency, so they still contain these issues.

## Sources

Research
- Hirsh-Pasek et al. 2015, *Putting Education in "Educational" Apps*: https://doi.org/10.1177/1529100615569721 · summary https://www.psychologicalscience.org/publications/educational-apps.html
- Kirkorian et al. 2016, toddlers' word learning from contingent touchscreen video: https://onlinelibrary.wiley.com/doi/10.1111/cdev.12508 · open copy https://digitalcommons.hollins.edu/cgi/viewcontent.cgi?article=1000&context=psychfac
- Kirkorian / Choi et al. 2017, Frontiers in Psychology: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00578/full
- Walter-Laager et al. 2017, word-learning app and 2-year-olds: https://doi.org/10.1111/bjet.12472
- Word learning from a tablet app, PLOS ONE 2020: https://dx.doi.org/10.1371/journal.pone.0240519
- Abdul Aziz et al. 2014, touch gestures for children: https://thesai.org/Downloads/Volume5No4/Paper_15-Selection_of_Touch_Gestures_for_Children%E2%80%99s_Applications_Repeated_Experiment_to_Increase_Reliability.pdf
- Vatavu, Cramariuc & Schipor 2015, touch input ages 3–6: https://mintviz.usv.ro/publications/ijhcs2015.pdf
- Nacher et al. 2015, multi-touch gestures for pre-kindergarten children: https://doi.org/10.1016/j.ijhcs.2014.08.004
- Hiniker et al. 2015, touchscreen prompts for preschoolers: https://doi.org/10.1145/2771839.2771851
- Vlach, Ankowski & Sandhofer 2012 (spaced presentation, 2-year-olds): https://pmc.ncbi.nlm.nih.gov/articles/PMC3302959/
- Leonard et al. 2019, repeated retrieval: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6802889/
- Leonard & Deevy 2020, retrieval practice in SLI and typical peers (review): https://pmc.ncbi.nlm.nih.gov/articles/PMC8084525/
- Leonard, Kueser, Deevy, Haebig et al. 2022, immediate vs. spaced retrieval in preschoolers: https://pmc.ncbi.nlm.nih.gov/articles/PMC9629778/
- Leonard et al. 2024, expanding vs. equal retrieval: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11087082/
- Haebig et al. 2021 (PDF): https://learninglab.psych.purdue.edu/downloads/2021/2021_Haebig_et_al_JSLHR.pdf
- Wilson et al. 2019, *The Eighty Five Percent Rule for optimal learning*: https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579
- 3-up/1-down staircase (3C Platform docs): https://ncmlab.github.io/NCMLabOnlineTools/features/adaptive-difficulty/
- Multidimensional probabilistic DDA in children (148 children, converged to ZPD): https://dl.acm.org/doi/10.1007/978-3-032-11043-5_25
- Klinkenberg et al. 2011, Math Garden adaptive practice: https://doi.org/10.1016/j.compedu.2011.02.003
- Cochrane review, vocabulary interventions for L2 learners up to age 6: https://www.cochrane.org/ru/node/6179
- Songs + TPR with Thai preschoolers: https://so05.tci-thaijo.org/index.php/thaitesoljournal/article/view/252356
- Songs, stories and preschool EFL vocabulary (2018): https://eld.bl.uk/catalog/100068165314_0x000001
- CDC milestones, 2 years: https://www.cdc.gov/act-early/milestones/2-years.html · 5 years: https://www.cdc.gov/act-early/milestones/5-years.html

Apps
- Khan Academy Kids Learning Path: https://khankids.zendesk.com/hc/en-us/articles/360048828572-Learn-more-about-the-Learning-Path · level adjustment: https://khankids.zendesk.com/hc/en-us/articles/360041615571
- Lingokids level adaptation: https://help.lingokids.com/hc/en-us/articles/360019924937-How-do-I-know-what-my-kid-s-level-is · methodology: https://help.lingokids.com/hc/en-us/articles/208259345-Lingokids-learning-methodology
- Sago Mini letter to parents: https://sagomini.com/article/sago-mini-letter-to-parents/
- Gus on the Go review (lessons, hidden-animal farm, unlockable games): https://igamemom.com/toddler-spanish-app-gus-on-the-go/ · https://screenwiseapp.com/media/gus-on-the-go-game
- Endless Alphabet (no scores or failures, talking letters): https://play.google.com/store/apps/details?hl=en&id=com.originatorkids.EndlessAlphabet
- DragonBox Numbers (Nooms, manipulatives): https://dragonbox.com/products/numbers
- Duolingo ABC, how it teaches: https://abc.duolingo.com/how-we-teach
- Pok Pok Playroom: https://playpokpok.com/blog/pok-pok-playroom-launches-today-7d0209e95f8b/
- Tiger eAcademy: https://eacademy.kids/ · PBS Kids Games: https://pbskids.org/games
