# World and game map

Status: **proposal — pending owner approval**. This is a content map for planning, not a commitment to build every game at once. The proposed implementation order is in `docs/ARCHITECTURE.md`. The ideas are original; they borrow *patterns* from the inspiration apps, and do not copy characters, plots, or assets.

The world is shared by both girls. Each game has an age-2 variant (exploration, few choices, touch, audio and demonstration, can finish at any moment) and an age-5 variant (a task inside a story, several steps, an extra attribute or a changing rule). Age is the default track on the profile; ability in each domain and language is measured separately and does not automatically advance other domains.

The navigation shell is in Hebrew. In language games, the learning language for a round is English or French. In number and science games the instruction starts in Hebrew, unless the goal itself is vocabulary in a learning language.

### What is in the pilot and what is in the vision (updated after the reviews)

This table lives in this document, not only in the roadmap, so it does not look as if all the games are the near-term implementation scope.

| Stage | Scope | Status |
|---|---|---|
| P0 | Skeleton + map, Animal Restaurant at both age levels, leisure corner (bubbles), leisure engine and parent area | **proposal — pending owner approval**; this is the next step after architecture approval |
| P1 | One more game in the Language House (Travel Suitcase or Word Song) + a sort/drag template | After P0 is stable on the tablet |
| P2 | First Number Garden game (Picnic Train) | According to what the girls enjoyed |
| Vision | The remaining games and areas in this document | Not built all at once |

The two foundation templates for P0–P1: **choice/serve** and **sort/drag**. The rest are opened when there is a real need.

### Owner-approved ideas (2026-11-13)

Thirteen ideas were approved by the owner as vision-stage entries. Build order and exact placement are **pending owner decision**. These ideas keep the current direction: ages 2 and 5, English/French learning languages with a Hebrew navigation shell, leisure time, the parent area, per-world characters, and adaptive difficulty.

- **Balloon Pop** (Number Garden) — pop the balloon of the named color or the spoken digit.
- **Number Bridge** (Number Garden) — pick the missing number, or add "one more stone", so the character crosses.
- **Letter Monster** (Language House) — feed the monster cookies by color/shape or by initial letter.
- **Word Train** (Language House) — load named objects, or drag letters to spell short English words.
- **Shadow Match** (Nature Lab) — identify an animal by its silhouette and its sound.
- **Seed to Flower** (Nature Lab) — water and sun make the plant grow, with no failure.
- **Potion Lab** (Science World; placement pending: default separate map area, **pending Maor decision**) — mix two colors and hear the new color's name.
- **Sink or Float** (Science World; placement pending: default separate map area, **pending Maor decision**) — drop an object, or predict first, and watch.
- **Magic Magnet** (Science World; placement pending: default separate map area, **pending Maor decision**) — drag a magnet and see what sticks.
- **Wardrobe** (Rewards and creation) — hats and accessories earned through progress, to dress the existing world characters.
- **Sticker Board and Finger Drawing** (Art Studio) — stickers and finger drawing on backgrounds.
- **Parent gate by 3-second long-press** (Infrastructure) — a simple gate for the parent area.
- **Station trail inside each world** (Infrastructure) — stars on completed games and a gentle pulse on the suggested next game, with no locks.

---

## The main map

The girl chooses an area on a small home island. The proposed areas:

| Area | Role | Earns leisure? |
|---|---|---|
| Language House | Understanding words and requests in English and French | Yes |
| Number Garden | Quantity, sorting, comparison | Yes, when the activity is marked educational |
| Nature Lab | Creatures, cause and effect, curiosity | Yes |
| Science World | Mixing, floating, magnets: simple experiments (separate area or part of Nature Lab: **pending owner decision**) | Yes |
| Art Studio | Drawing, coloring, building; some activities earn | According to the mark in the content |
| Leisure Corner | Content the parent approved (for example bubbles, free drawing, a short video in the future) | No; spends balance |

The number of areas and their names are a **proposal — pending owner approval**. The three learning rooms already appeared in the vision documents; the studio and the leisure corner were proposed alongside them.

---

## Language House

Goal: understand a request or a word in the learning language and act in the world. General inspiration: voice guidance and clear progress from Tiger eAcademy; songs and word games with fixed characters from Lingokids; learning by preparing an order or arranging a shop, in the pattern of Sago Mini.

### 1. Animal Restaurant — the existing flagship game

- **Stage:** P0.

- **Action:** An animal asks for food out loud, the girl prepares and serves it, the animal reacts happily.
- **Learning goal:** Understanding food names and requests in English or French.
- **Inspiration pattern:** Sago Mini (acting inside a familiar world teaches); Tiger eAcademy (voice instruction, immediate feedback, visible progress).
- **Age 2:** A choice between two foods, a demonstration if needed, a large touch target, can ask to hear again.
- **Age 5:** A request with a quantity or an attribute (a red apple, two cookies), sometimes two steps (choose and then serve).
- **Status:** Exists as a prototype; migration to graphics, animation, and JSON content is the first task after the skeleton.

### 2. Travel Suitcase

- **Stage:** P1 (one of two; both are not required in the same round).

- **Action:** A character is getting ready for a trip or a picnic and asks for items in the learning language; the girl puts them in the bag.
- **Learning goal:** Vocabulary of clothes, objects, and nature, and understanding "put the…".
- **Inspiration pattern:** Sago Mini (preparing for a play world); Lingokids (words in topic groups); Tiger eAcademy (a short voice-guided sequence).
- **Age 2:** One item out of two, placed by touch (precise dragging is not required).
- **Age 5:** Two or three items, perhaps negation or a description ("not the red hat" / "pas le chapeau rouge") at an advanced stage.

### 3. Word Song with the house characters

- **Stage:** P1 (alternative or complement to Travel Suitcase).

- **Action:** A fixed character from the map sings or says a short rhyme, and the girl touches what was said in time or at the end of the line.
- **Learning goal:** Listening for rhythm and a target word, enjoyable repetition of the same words.
- **Inspiration pattern:** Lingokids (songs and fixed characters); Tiger eAcademy (clear voice accompaniment).
- **Age 2:** A very short song, one prominent word, free repetition with no time pressure.
- **Age 5:** Two or three words, a choice at the end of the song, or completing a missing word from the pictures.

### 4. Letter Monster

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** A friendly monster is hungry; the girl feeds it cookies that match what it asks for.
- **Learning goal:** Matching by color and shape, then by the initial letter of a word in English or French.
- **Inspiration pattern:** Lingokids (words with a fixed character); Sago Mini (feeding and serving in a play world).
- **Age 2:** Feed by color or shape.
- **Age 5:** Feed by the initial letter of a word in English or French.

### 5. Word Train

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** Loading a train: the girl loads a named object onto a carriage, or drags letters to spell a short word.
- **Learning goal:** Object vocabulary in the learning language (age 2); spelling short English words, for example cat or sun (age 5).
- **Inspiration pattern:** Lingokids (words in topic groups); Tiger eAcademy (a short voice-guided sequence).
- **Age 2:** Load a named object onto the train.
- **Age 5:** Drag letters to spell a short English word (for example cat, sun).

### 6. Kitchen Orchestra

- **Stage:** Built (on `main`). Moved here from Art Studio by the owner's decision of 2026-11-12; reached through the Language House game picker (Animal Restaurant, Kitchen Orchestra, or Word Train). Full spec: [docs/specs/kitchen-orchestra.md](specs/kitchen-orchestra.md).

- **Action:** A chef plays a short pattern on kitchen utensils (pot, pan, water glasses) and names them in the learning language; the girl echoes the pattern by tapping the utensils.
- **Learning goal:** Kitchen utensil words and simple requests in English or French ("Play the pot!", "Listen!", "Your turn!"); listening to a pattern and imitating a short sequence.
- **Inspiration pattern:** Sago Mini (free exploration); Tiger eAcademy (a short guided sequence, in the older-girl version).
- **Age 2:** One lit note at a time with a demonstration hint after idle time; free playing while listening never counts as a mistake.
- **Age 5:** Repeat a sequence of three or more sounds, moving from lit to flash to audio-only cues.

---

## Number Garden

Goal: a sense of quantity, one-to-one matching, sorting, and comparison. Instruction is in Hebrew, unless English or French counting is deliberately included as a separate skill. General inspiration: action that teaches (like the idea behind DragonBox, without copying the mechanic); a path by domain from Khan Academy Kids; calm exploration from Sago Mini.

### 1. Picnic Train

- **Stage:** P2, the first proposed quantity game.

- **Action:** Passengers are missing equipment; the girl distributes it, sees that the train is ready, and the characters set off.
- **Learning goal:** One-to-one matching, "how many are missing", small quantities.
- **Inspiration pattern:** Sago Mini (an animal/travel world); Khan Academy Kids (quantity practice in context, not a worksheet).
- **Age 2:** One item for each character (two or three characters).
- **Age 5:** Discover how many are missing, distribute in several ways, or compare two carriages.

### 2. Sorting Beds

- **Stage:** Vision / after P2; the template itself (sort/drag) starts earlier if needed.

- **Action:** Fruit, leaves, or flowers have "fallen" out of order; the girl returns them to the bed by color, shape, or size.
- **Learning goal:** Sorting by one attribute, then by two attributes.
- **Inspiration pattern:** Sago Mini / the "messy shop" idea from the vision; Tiger eAcademy (a short task with a clear rule).
- **Age 2:** One attribute, two beds, placement by touch.
- **Age 5:** Two attributes, or a rule that changes mid-way ("now only the small ones").

### 3. Garden Scales

- **Stage:** Vision.

- **Action:** One side of a scale or basket is short; the girl adds items until the sides balance or reach a target.
- **Learning goal:** Comparing quantities, "more / less / the same", composing small numbers.
- **Inspiration pattern:** A concrete action that teaches quantity (principle inspired by DragonBox Numbers); Khan Academy Kids (gradual progress in arithmetic).
- **Age 2:** Add until the same visual number is reached, with no symbols.
- **Age 5:** Complete to a given sum, or choose between two ways to compose the same number.

### 4. Balloon Pop

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** Balloons float up; the girl pops the one that was named.
- **Learning goal:** Color names (age 2) and recognizing digits by ear (age 5); numbers may be voiced in English or French as a deliberate counting-language skill, consistent with the Number Garden intro.
- **Inspiration pattern:** Khan Academy Kids (number practice in context); Tiger eAcademy (a short voice-guided task with immediate feedback).
- **Age 2:** Pop the balloon of the named color.
- **Age 5:** Pop the balloon with the spoken digit.

### 5. Number Bridge

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** A character needs to cross a bridge; the girl completes the bridge so the character can cross.
- **Learning goal:** Number sequence and the missing number (age 5); "one more" (age 2).
- **Inspiration pattern:** Khan Academy Kids (gradual progress in number sense); Sago Mini (a character travelling through a play world).
- **Age 2:** "One more stone": add one stone so the character can step across, with no symbols.
- **Age 5:** Pick the missing number in a short sequence, and the character crosses the bridge.

---

## Nature Lab

Goal: curiosity, naming in Hebrew and in the learning languages as needed, cause and effect. Inspiration: exploration without failure from Sago Mini / Pok Pok; a varied path (a short book + an activity) from Khan Academy Kids; short voice-guided tasks from Tiger eAcademy.

### 1. Who's Hiding? — the Nature Lab entry game

- **Stage:** Pass 1 (working game).

- **Action:** Several bushes stand in a meadow, a different animal hiding behind each one and peeking out. The girl hears a request in English or French and taps the bush that hides that animal; the animal pops out and a star flies to the counter.
- **Learning goal:** Animal names and animal sounds in English and French; matching a sound or a name to a partly hidden animal.
- **Inspiration pattern:** Tiger eAcademy (short voice-guided task, immediate feedback); Sago Mini (calm exploration, the world responds). The game reuses the choice/serve template (bushes instead of plates) and the existing animal art.
- **Age 2:** Starts at Level 2: few bushes, a picture-and-audio request, a demonstration hint if she waits, large touch targets, can hear the request again.
- **Age 5:** Starts at Level 5: more bushes, less visual support, a short sound word, a hint only after a mistake.
- **World wiring:** Nature Lab is open on the map with `entryGameId` `who-is-hiding`. Tapping the building opens Who's Hiding? directly (no game picker in Pass 1).

### 2. Who Lives Here?

- **Stage:** Vision (a later Nature Lab game; Who's Hiding? is the entry game, decided 2026-11-13).

- **Action:** The girl helps an animal go home (nest, cave, water, tree) according to a voice hint or a picture.
- **Learning goal:** Matching a creature to a habitat, animal vocabulary.
- **Inspiration pattern:** Sago Mini (calm exploration, the world responds); Tiger eAcademy (short voice instruction).
- **Age 2:** Two animals and two homes, an immediate warm reaction even on a second try.
- **Age 5:** A descriptive hint ("I sleep in a cave" / "Je vis dans l'eau"), or several creatures in sequence.

### 3. Weather in the Window

- **Stage:** Vision.

- **Action:** The girl changes sun, rain, or wind and sees what happens to the plants, the puddle, or the laundry.
- **Learning goal:** Cause and effect, weather vocabulary, simple prediction.
- **Inspiration pattern:** Sago Mini (free play with no failure); Khan Academy Kids (short concrete science).
- **Age 2:** One switch — touch and see what happens, with no "right answer".
- **Age 5:** "What will happen if…", choosing suitable clothing, or two changes in sequence.

### 4. Little Nature Book

- **Stage:** Vision.

- **Action:** A short book with an interactive page: touch a creature, hear its name, move one element on the page.
- **Learning goal:** Naming, listening, a short story sequence.
- **Inspiration pattern:** Khan Academy Kids (a book + an activity on the same path); Lingokids (words with a fixed character).
- **Age 2:** Two or three pages, free touching, can leave on any page.
- **Age 5:** A small question at the end of the story, or a learning-language word next to the picture.

### 5. Shadow Match

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** The girl identifies an animal by its silhouette and its sound; the name is heard in Hebrew, English, and French.
- **Learning goal:** Animal names and sounds, matching a shape to a creature.
- **Inspiration pattern:** Tiger eAcademy (short voice-guided task, immediate feedback); Sago Mini (calm exploration, the world responds).
- **Age 2:** Two silhouettes, the sound plays, touch to reveal the animal.
- **Age 5:** More silhouettes; the cue is the sound only or the name only, in the learning language.

### 6. Seed to Flower

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** Water and sun make a plant grow from a seed to a flower; there is no failure state.
- **Learning goal:** Cause and effect, the stages of growth, and stage names in the learning language (age 5).
- **Inspiration pattern:** Sago Mini / Pok Pok (exploration without failure); Khan Academy Kids (short concrete science).
- **Age 2:** Free touch on water and sun; the plant grows.
- **Age 5:** A simple order (water, then sun), or naming the stages in the learning language.

---

## Science World

Goal: simple play-level experiments: mixing, floating, magnets. Cause and effect through touch, with no failure. Whether Science World is a separate map area or part of Nature Lab is pending owner decision. Inspiration: exploration without failure from Sago Mini / Pok Pok; short concrete science from Khan Academy Kids.

### 1. Potion Lab

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** The girl mixes two colors and hears the name of the new color in Hebrew, English, and French.
- **Learning goal:** Color mixing and color names in three languages.
- **Inspiration pattern:** Sago Mini (free play with no failure); Khan Academy Kids (short concrete science).
- **Age 2:** Free mixing; see and hear the result.
- **Age 5:** A request such as "make green": choose the two colors first.

### 2. Sink or Float

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** The girl drops objects into water and watches whether they sink or float.
- **Learning goal:** Cause and effect, simple prediction, object vocabulary.
- **Inspiration pattern:** Khan Academy Kids (short concrete science, prediction); Pok Pok (open exploration).
- **Age 2:** Just drop the object and watch.
- **Age 5:** Predict sink or float, then watch.

### 3. Magic Magnet

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** The girl drags a magnet over a scene and sees what sticks.
- **Learning goal:** Cause and effect, simple prediction, grouping objects by what happens.
- **Inspiration pattern:** Pok Pok (open exploration); Khan Academy Kids (short concrete science, prediction).
- **Age 2:** Free dragging; items jump to the magnet.
- **Age 5:** Predict which items will stick, then test.

---

## Art Studio

Goal: expression, motor skills, choice. Marked educational creation can earn leisure; free creation can also serve as leisure. Inspiration: creation in Sago Mini and Khan Academy Kids; daily-path variety from Khan Academy Kids.

### 1. Color the World

- **Stage:** Near-term vision; can appear early if leisure/creation beyond bubbles is missing.

- **Action:** Coloring a character or a background from the map with large colors, with area fills.
- **Learning goal:** Color names (Hebrew, and optionally English/French), choosing and finishing a creation.
- **Inspiration pattern:** Sago Mini and Khan Academy Kids (creation as part of the world, not a separate, cold tool).
- **Age 2:** Fill by touch, a few large colors, "going outside the line" is not treated as a mistake.
- **Age 5:** More areas, an optional request ("color the apple red"), saving the creation in a local album.

### 2. Bubbles and Dreams (also as leisure)

- **Stage:** P0 as the leisure corner.

- **Action:** Touching bubbles, a joyful pop, changing colors. Exists in the spirit of the prototype.
- **Learning goal:** Secondary; mainly regulation, enjoyment, and a calm ending.
- **Inspiration pattern:** Leisure inside the app, like a free-play corner and not like a lesson.
- **Age 2 and 5:** The same activity, with different density and complexity. If this is a leisure corner — it does not earn new time.

### 3. Sticker Board and Finger Drawing

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** Placing stickers and drawing with a finger on a background (space, jungle, or beach). Whether it earns leisure follows the Art Studio content mark.
- **Learning goal:** Expression, motor skills, choice; secondary vocabulary when a request is given.
- **Inspiration pattern:** Sago Mini and Khan Academy Kids (creation as part of the world).
- **Age 2:** Free sticker placement and finger painting.
- **Age 5:** An optional request ("put the rocket in space"), or saving to the local album.

---

## Rewards and creation

Goal: a reward on top of leisure-time earning, not a replacement for it. Sticker Board and Finger Drawing lives in Art Studio (see Art Studio, game 3).

### 1. Wardrobe

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** Hats and accessories earned through progress are used to dress our existing per-world characters. This is not a player avatar, and it does not replace leisure-time earning.
- **Learning goal:** Choice and expression, clothing vocabulary; a motivation for continuing.
- **Inspiration pattern:** Sago Mini (dressing up characters in a play world); Lingokids (fixed characters).
- **Age 2:** Tap an item to put it on a character.
- **Age 5:** Choose items and save an outfit.
- **Open question:** Which progress unlocks which item: pending owner decision.

---

## Infrastructure (approved ideas)

Goal: supporting features, not learning games.

### 1. Parent gate by 3-second long-press

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** The parent enters the parent area by pressing and holding for 3 seconds. Whether it replaces or is added to the current parent gate: pending owner decision.
- **Learning goal:** Not a learning game; keeps the parent area out of the girls' reach.
- **Inspiration pattern:** A common children's-app pattern for parent areas; no specific source app.
- **Age 2 and 5:** Same for both ages (the gate is for the parent).

### 2. Station trail inside each world

- **Stage:** Vision / approved idea (owner-approved 2026-11-13; build order pending owner decision).

- **Action:** A trail of stations inside each world: stars on completed games, and a gentle pulse on the suggested next game, driven by adaptive difficulty. There are no locks; every game stays open.
- **Learning goal:** Not a learning game; shows progress and gently guides the next choice.
- **Inspiration pattern:** Tiger eAcademy (clear, visible progress); Khan Academy Kids (a path by domain).
- **Age 2 and 5:** Same for both ages; the suggestion follows each girl's own adaptive level.

---

## What is not built in the pilot

**proposal — pending owner approval.** Kept for the broader vision: systematic Hebrew reading and writing, physics and chemistry, AI and systems understanding, control of device content, and age 6–9 tracks. The Science World ideas (Potion Lab, Sink or Float, Magic Magnet) are simple play-level cause and effect, not systematic physics or chemistry, and are vision-stage. Here too we will not copy content from the inspiration apps, and we will not add ads, purchases, or a cloud account.

World characters will be original and consistent (kitchen, garden, lab, studio), so the girls recognize them from the map to the game. Character and style choices are a **proposal — pending owner approval**.
