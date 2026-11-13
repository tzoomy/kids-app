<!-- Raw output: Claude Code, model claude-opus-5-5, run 2026-11-11 22:23 Asia/Jerusalem, same brief as gemini-games.md. Not edited. -->

I've finished the research and am now writing the final document.

# Two adaptive games per world: research and design proposal

*Kids learning PWA (Phaser 3, Hebrew UI, EN/FR content). Ages 2 and 5.*

## 1. What the research says, and what it means for the design

**Early second-language vocabulary**
- **Matching a picture to a spoken word works.** So does acting out words (TPR) and singing, especially together. A Thai study of 72 preschoolers found songs and TPR each helped vocabulary, and the combination helped most (Thai TESOL Journal). Most TPR and song studies are small, so treat them as suggestive.
- **Books help, but only a little.** A Cochrane review of L2 vocabulary interventions for children up to age 6 found shared book reading with planned target words was the most common method. Its effect on general receptive vocabulary was small (SMD 0.29, low certainty).
- **Design takeaway:** have the child *do* something with each word (put it somewhere, feed it, colour it, act it out). Repeat the same small word set often.

**Spaced retrieval in preschoolers**
- Preschoolers learned new words better from spaced, repeated retrieval than from repeated study or immediate retrieval. They recalled more labels and meaning features (Haebig et al. 2021).
- Expanding schedules gave early gains that faded. After a week they were no better than equal spacing (Leonard et al. 2024).
- **Design takeaway:** bring words back across sessions with simple box-based spacing. Don't over-tune the schedule.

**Adaptive difficulty**
- The "85% rule": learning is fastest at roughly 85% accuracy (Wilson et al. 2019). The proof is for simple right/wrong learning tasks, so use it as a rough target, not a law.
- A children's DDA study (148 children) found difficulty settled at each child's own level within the first hour.
- One review notes there is no firm evidence that adaptive serious games beat non-adaptive ones.
- **Design takeaway:** aim for about 75–85% correct for age 5. For age 2, aim for about 90%+ (near-errorless).
- Khan Academy Kids works the same way: progress depends on mastering each topic, and a struggling child gets "more basic lessons with additional scaffolding."

**Touchscreens and toddlers**
- **Taps work at 2; drags are unreliable.** 2-year-olds can tap and drag in some studies (Abdul Aziz 2013, via Nacher et al.). But in another study only 27% of 2–3-year-olds tapped the intended spot (Clin Exp Pediatr 2020).
- **Rule for age 2:** tap-to-place (tap the item and it flies to its spot), huge targets, no precise dragging.
- **Interactivity helps the youngest only when it points at the key information.** For slightly older toddlers it can get in the way (Kirkorian/Choi, Frontiers 2017).
- **Rule for age 2:** every tap should be *on the word's referent*, never a decorative tap.
- **No single interaction type was best** for ages 2–4 (Russo-Johnson et al. 2017).
- **AAP "Media and Young Minds":** discourage solo media use for the youngest. Toddlers learn words from media mainly when a parent co-views. Design age-2 sessions to be short and played together.

**Enjoyment as the quality bar**
- Hirsh-Pasek et al. (2015) list four pillars: active, engaged (not distracted), meaningful, and social, all serving a clear learning goal.
- Sago Mini and Pok Pok show the enjoyment side: no game-over screens, no timers, nothing to do "wrong."
- **Design takeaway:** adaptivity should be invisible. A wrong answer gets a funny, gentle reaction and another try, never a fail screen.

**Apps surveyed (patterns to borrow)**

| App | Pattern to borrow |
|---|---|
| Lingokids | Topic word groups, songs, recurring characters |
| Gus on the Go | ~90 core words by theme, explore first then quiz game; stays on a lesson until mastered; offline, no ads |
| Khan Academy Kids | Mastery-based learning path per topic |
| Duolingo ABC | Short multi-sensory lessons (trace, drag-and-drop) |
| DragonBox Numbers | Math that "doesn't feel educational" |
| Sago Mini / Pok Pok / Toca | Toy-like worlds with no failure state |

## 2. Shared conventions for all games

- **Two tracks, one engine.** Age sets the starting level. The adaptive engine then moves the child within that track and can cross into the other track's levels.
- **Age-2 rules:**
  - 1–2 targets on screen, tap-to-place.
  - Errorless: after a miss, the wrong item wiggles away and the right one glows. A hint plays automatically after about 6 seconds.
  - Levels only change *between* rounds.
  - Response time is ignored as a signal, because it is too noisy at this age.
- **Age-5 rules:**
  - 3–6 choices, real drag, multi-step tasks.
  - Response time *is* a signal.
- **Signals:** correct on first try, number of tries, hints used (replay audio or the glow hint), response time (age 5 only), and quitting mid-round.
- **Levers:** number of choices, how similar the distractors are, the item set (new vs. known words), sentence complexity, speed, and picture support (picture + audio → audio only → descriptive clue).

## 3. Language House

### Animal Restaurant: adaptive upgrade notes (existing game)

- **Level ladder:**
  - L1: 2 plates, very different foods.
  - L2: 3 plates.
  - L3: 4 plates with similar distractors (apple vs. tomato, both red).
  - L4: quantity ("two cookies").
  - L5: attribute ("the green apple").
  - L6: two-item order.
  - L7: audio only, with the animal's speech bubble hidden.
- **Moving between levels:** 3 first-try correct answers in a row with no hint → up. 2 misses in a row → down one level, and the next item is one the child knows.
- **Spacing per food word:** missed words come back in the same session (after 2–3 other items) and again next session. Each round mixes about 1 new word with 3 known ones.
- **Language:** track EN and FR separately for the same food (`food.apple.en` / `food.apple.fr`). French will likely start higher because it is the family language.

### Game 1: Travel Suitcase (מזוודת הטיול)

- **Mechanic:** A character packs for a trip and asks in the learning language, "Put the hat in the suitcase!" The child drags the item in, the suitcase closes, and the character goes on a short trip animation.
- **Teaches:** clothes and objects (hat, shoes, ball / chapeau, chaussures, ballon), "put the…", and at higher levels colours, numbers and negation.
- **Age 2:** 1 of 2 items, tap-to-place. Each correct item pops out with a sound, and the character tries it on.
- **Age 5:** 2–3 items per request ("the red hat and two socks"). Later: "not the blue one" / "pas le bleu".
- **Adaptive rules:**
  - Levers in order: choices 2→3→4→6. Then distractors similar in category, then in colour. Then requests with 1→2→3 items. Then attributes. Then negation. Then audio only.
  - Up after 3 first-try correct answers in a row. Down after 2 misses in a row, or after 2 hint replays on one request.
  - Age 5: if the median response time is under about 3 seconds at ≥85% correct, skip a level.
- **Inspired by:** Sago Mini (getting ready for play), Lingokids (topic word groups), TPR.
- **Effort:** S once sort/drag exists.
- **Template:** sort/drag (one drop zone). This is a good first sort/drag game.

### Game 2: Puppet Says (הבובה אומרת)

- **Mechanic:** A friendly puppet sings a short line or gives a command: "Touch your nose!", "Clap!", "Jump!". The child taps the body part or action card, and the puppet does it with a funny animation. The child is invited, but not required, to copy it in real life.
- **Teaches:** body parts and action verbs (nose, ears, jump, clap / nez, oreilles, saute, tape des mains). This is the on-screen version of TPR with songs.
- **Age 2:** tap a big body part on the puppet, picking from 2 highlighted body parts. The puppet always ends with a little dance. Good for playing together with a parent.
- **Age 5:** 3–6 choices, verbs plus body parts ("wave your hand"). Later: two-step commands ("touch your nose, then jump") tapped in order, and a missing word at the end of a song line.
- **Adaptive rules:**
  - Levers: number of tappable spots 2→6. Body parts next to each other (eyes and ears; hand and arm) as harder distractors. Nouns only → verbs → 2-step sequences. Song tempo.
  - Up after 3 first-try correct answers in a row. Down after 2 misses in a row.
  - Words that are often confused go into the same box to come back together next session.
- **Inspired by:** Lingokids (songs, recurring characters); the Thai songs + TPR study.
- **Effort:** M (puppet animation set).
- **Template:** choice/serve (hotspots instead of plates) with a small extension for steps in order.

## 4. Number Garden (Hebrew instructions; EN/FR counting as a separate optional skill)

### Game 1: Picnic Train (רכבת הפיקניק)

- **Mechanic:** Animal passengers on a train are each missing something (a hat, an apple). The child hands them out one-to-one, then the train whistles and leaves.
- **Teaches:** one-to-one matching, "how many are missing?", and counting 1–10. Optionally, counting words in EN/FR.
- **Age 2:** 2–3 passengers, tap an item and it flies to the next empty seat. Pure one-to-one with no numerals.
- **Age 5:** "The train needs 7 apples, 4 are already here. How many more?" Choose a number tile or drag the exact amount. Later, compare two carriages.
- **Adaptive rules:**
  - Levers: set size 2→3→5→7→10. Neat rows → scattered layout. Matching → "how many missing" → choosing a numeral. Spare decoy items (age 5).
  - Up after 3 first-try correct answers in a row. Down after 2 misses or one hint.
  - Age 5: if the child counts slowly but correctly (high response time), stay on the level and add finger-dot hints rather than going up.
- **Inspired by:** Khan Academy Kids (quantity in context), Sago Mini (travel world).
- **Effort:** S–M.
- **Template:** sort/drag (several drop targets).

### Game 2: Garden Scales (מאזני הגינה)

- **Mechanic:** Two baskets on a seesaw. The child adds or removes fruit until the sides balance or the target is reached, and the seesaw levels with a happy chime.
- **Teaches:** more / less / same, comparing, and making small numbers in different ways (5 = 2+3 = 4+1).
- **Age 2:** "Which has more?" Tap the heavier basket, which has very different amounts (1 vs. 4). Then add fruit until both look the same.
- **Age 5:** Make the number shown on a sign. Then "find two ways to make 6". Later, use fruit worth 2 (a melon = 2 apples).
- **Adaptive rules:**
  - Levers: ratio between quantities (1:4 → 3:4, closer is harder). Size of the numbers. Pictures → dot-cards → numerals. Single fruit → fruit worth 2.
  - Promote at ≥85% correct over the last 6 rounds. Demote below 60%, or after 2 misses in a row.
- **Inspired by:** DragonBox Numbers (quantity you can touch and move).
- **Effort:** M (seesaw physics-lite).
- **Template:** sort/drag plus choice/serve for the "which is more" step.

## 5. Nature Lab

### Game 1: Who Lives Here? (מי גר כאן?)

- **Mechanic:** A lost animal appears. The child drags it home to a nest, pond, cave, tree or farm, and the home lights up with a family reunion animation.
- **Teaches:** animal names (EN/FR), where animals live, and simple descriptions ("I live in the water" / "Je vis dans l'eau").
- **Age 2:** 2 animals and 2 very different homes, tap-to-place. The animal is named when it arrives.
- **Age 5:** 3–4 homes. A spoken riddle replaces the picture ("I have feathers and I sleep in a tree"). Later, several animals in a row, or animals with two possible homes (frog: pond or land).
- **Adaptive rules:**
  - Levers: number of homes 2→4. Animal picture shown → name only → descriptive riddle (audio only). Homes that are alike (tree vs. nest). New animals added at about 1 new to 3 known.
  - Up after 3 first-try correct answers in a row. Down after 2 misses in a row.
  - Age 5: a riddle that needs 2+ replays counts as half-correct.
- **Inspired by:** Sago Mini (calm, responsive world), Gus on the Go (animal word themes).
- **Effort:** S.
- **Template:** sort/drag.

### Game 2: Who's Hiding? (מי מתחבא?)

- **Mechanic:** Bushes rustle and an animal is hiding. The child hears a sound, a name or a clue, then taps the right bush. The animal jumps out ("Coucou!") with a funny reaction.
- **Teaches:** animal names and sounds, plus describing words (big, small, stripes, long tail / grand, petit, rayures).
- **Age 2:** 2 bushes with a body part clearly sticking out (an ear or tail). The animal's sound plus its name.
- **Age 5:** 3–5 bushes. The name alone, then a clue only ("it's small and has a long tail"). Later, two clues combined.
- **Adaptive rules:**
  - The main lever is **how much is visible**: half the animal → only a tail → nothing (audio only).
  - Other levers: number of bushes. Sound + name → name only → clue. Distractors that sound or look alike (cat vs. tiger).
  - Up after 3 correct answers in a row. Down after 2 misses. Each hint (rustle replay) reveals more of the animal and is logged.
- **Inspired by:** Khan Academy Kids (short concrete science), Tiger eAcademy (short spoken tasks).
- **Effort:** S.
- **Template:** choice/serve (bushes as plates). This is the cheapest new-world validation.

## 6. Art Studio

### Game 1: Color the World (צובעים את העולם)

- **Mechanic:** Colour a scene from the map with big tap-to-fill areas. Sometimes a character asks for something ("Colour the apple red!" / "Colorie la pomme en rouge!"). Every creation goes into an album.
- **Teaches:** colour names (EN/FR), object names, following a direction. At higher levels, light and dark shades and mixing colours.
- **Age 2:** free filling, 4 big crayons, and each colour is named aloud when tapped. Optional "Find the red one!" with 2 crayons. Going outside the lines never counts as a mistake.
- **Age 5:** requests follow a ladder: colour only → colour + object → two-part requests → shades (light blue / bleu clair). Requests are mixed with free colouring.
- **Adaptive rules (only for request turns; free colouring is never scored):**
  - Levers: palette size 2→4→8. Close colours (orange vs. red, pink vs. purple). Request complexity. Audio only (no colour dot shown under the request).
  - Up after 3 correct requests in a row. Down after 2 misses. Never more than about 1 request per 3 fills, so it still feels like colouring.
- **Inspired by:** Sago Mini / Khan Academy Kids (making things inside the world).
- **Effort:** M (flood-fill + album).
- **Template:** new **create/fill** template. It is worth building because the leisure area needs creative play anyway.

### Game 2: Kitchen Orchestra (תזמורת המטבח)

- **Mechanic:** Pots, a xylophone made of glasses, and a drum that is a pan. Free play makes music. In echo mode, the chef plays a short pattern and the child repeats it, and the whole kitchen dances.
- **Teaches:** cause and effect, listening, short memory sequences, and instrument and object names in EN/FR ("Play the drum!" / "Joue du tambour!").
- **Age 2:** free play with no failure. Optional "Play the drum!" with 2 instruments that glow.
- **Age 5:** echo sequences of 2→5 sounds, with instruments named rather than lit up at higher levels.
- **Adaptive rules:**
  - Levers: sequence length 2→5. Playback speed. Lit-up instruments → sound only → spoken names only. Number of instruments 3→6.
  - Up after 2 sequences repeated perfectly in a row. Down after 2 failures in a row.
  - After a failure, replay the same sequence once with lights on, which works as a free hint.
- **Inspired by:** Sago Mini / Pok Pok (toy-like play), Tiger eAcademy (short guided sequence).
- **Effort:** M (audio timing).
- **Template:** choice/serve plus a small extension for steps in order (shared with Puppet Says).

## 7. Build-order recommendation

1. **Shared adaptive engine** (below), then retrofit Animal Restaurant to it. This validates the engine on a game that already exists.
2. **Who's Hiding?** (choice/serve, S): the cheapest new-world test with TTS.
3. **Sort/drag template + Travel Suitcase**, then **Who Lives Here?** and **Picnic Train**, which reuse the same template.
4. **Puppet Says** and **Kitchen Orchestra** (shared ordered-steps extension).
5. **Garden Scales**, then the **create/fill** template with **Color the World**.

After each step, watch which games the girls *choose* in free time. That is the enjoyment measure. Let it reorder the list.

## 8. Shared adaptive-difficulty engine (spec)

- **Storage:** `localStorage["adapt.v1.<profileId>"]` stores `{ skills: { "<world>.<game>.<lang>": { level, streak, missStreak, window: [last 8 outcomes], lastPlayed } }, items: { "<lang>.<wordId>": { box: 1-5, due, seen, correct } } }`.
  - Skills are per child, per game skill, and per language (EN and FR separate).
  - Keep the schema version in the key, write after every round, and include it in the backup/export from the parent area.
- **Outcome per trial:** `{ correct, firstTry, hints, rtMs }`. Score 1.0 = first try with no hint, 0.5 = correct after a hint or retry, 0 = wrong.
- **Default rules (each game can override):**
  - Up after 3 first-try correct answers in a row, or ≥85% over the window of 8.
  - Down after 2 misses in a row, or <60% over the window.
  - Change at most one level per round. Age 2 only changes between rounds and ignores response time.
- **Item scheduling (spaced retrieval):** Leitner-style boxes.
  - Correct moves the word up a box; a miss sends it back to box 1.
  - Box review times: box 1 = later in the same session, box 2 = next session, box 3 = 2 days, box 4 = 4 days, box 5 = 1 week.
  - Build each round from due words first, then about 1 new word for every 3 known.
- **Frustration guard:**
  - 3 misses in a round, or quitting mid-round → next round is a "confidence round" two levels down with familiar words, then go back up.
  - Never show failure. Rewards and leisure earning depend on effort and finished rounds, not accuracy.
- **Starting point and decay:**
  - New skills start from the age default.
  - French may start one level higher, chosen by the parent.
  - After more than 14 days without play, start one level lower.
  - The parent area shows each skill's level and can override it.
- **Content contract:** each game's JSON declares `levels[]` with its lever values (choices, distractor group, support mode, set size). The engine only picks the level index and the item IDs; templates read them.

## Sources

- Kirkorian & Choi et al., Frontiers in Psychology 2017 (touchscreen word learning in toddlers): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00578/full
- Frontiers news summary of the same: https://www.frontiersin.org/news/2017/05/09/touchscreens-frontiers-psychology-how-do-toddlers-learn-best-from-touchscreens
- Russo-Johnson et al. 2017 (ScienceDaily): https://sciencedaily.com/releases/2017/05/170508112428.htm
- Word learning from a tablet app, PLOS ONE 2020: https://dx.doi.org/10.1371/journal.pone.0240519
- Toddler gestures, Nacher et al. (IJHCS): https://riunet.upv.es/bitstream/handle/10251/64752/IJHCS-Nacher.pdf?sequence=2
- Clinical and Experimental Pediatrics 2020 (touchscreen skills 2–6 y): https://doaj.org/article/882f4a54da2249d9a2b669eea2a5ca9d
- Haebig et al. 2021, spaced retrieval in preschoolers: https://learninglab.psych.purdue.edu/downloads/2021/2021_Haebig_et_al_JSLHR.pdf
- Leonard et al. 2024, expanding vs. equal retrieval: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11087082/
- Wilson et al. 2019, "The Eighty Five Percent Rule for optimal learning": https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579
- Child DDA study (multidimensional probabilistic DDA): https://cris.huji.ac.il/en/publications/modeling-skill-progression-in-children-through-novel-multidimensi/
- Adaptive serious games / DDA review: https://arxiv.org/html/2402.01669v2
- Hirsh-Pasek et al. 2015, Putting Education in "Educational" Apps: https://www.psychologicalscience.org/publications/educational-apps.html
- Cochrane review, L2 vocabulary interventions up to age 6 (Hjetland et al.): https://www.cochrane.org/ru/node/6179
- Songs + TPR with preschoolers (Thai TESOL): https://so05.tci-thaijo.org/index.php/thaitesoljournal/article/download/252356/170761
- Songs and stories in preschool EFL (Albaladejo et al. 2018): https://eld.bl.uk/catalog/100068165314_0x000001
- TPR with 5–6-year-olds: https://jurnal.unissula.ac.id/index.php/elitation/en/article/view/51645
- AAP 2016 guidance (NPR): https://www.npr.org/sections/ed/2016/10/21/498550475/american-academy-of-pediatrics-lifts-no-screens-under-2-rule
- Khan Academy Kids Learning Path (help center): https://khankids.zendesk.com/hc/en-us/articles/360048828572
- Lingokids Playlearning: https://help.lingokids.com/hc/en-us/articles/23532720590610-What-is-Playlearning
- Lingokids methodology: https://educators.lingokids.com/methodology
- Gus on the Go (App Store): https://apps.apple.com/us/app/gus-on-the-go-spanish/id541567964
- Gus on the Go review: https://screenwiseapp.com/media/gus-on-the-go-game
- Sago Mini letter to parents: https://sagomini.com/article/sago-mini-letter-to-parents/
- Sago Sago on preschool design (Kidscreen): https://kidscreen.com/2015/04/09/sago-sago-dishes-on-developing-for-the-preschool-market
- Pok Pok Playroom launch: https://playpokpok.com/blog/pok-pok-playroom-launches-today-7d0209e95f8b/
- Duolingo ABC overview: https://www.eastersealstech.com/2023/09/28/duolingo-abc/
- DragonBox / app roundup (Cool Mom Tech): https://coolmomtech.com/?p=41787

*Note: these sources were found through web search. For most of them I relied on the search summaries and abstracts rather than reading the full text, so check exact numbers against the original papers. I found no solid design write-ups for Endless Alphabet, Toca Boca or PBS Kids, so those apps are not cited.*