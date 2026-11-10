# World and game map

Status: **proposal — pending owner approval**. This is a content map for planning, not a commitment to build every game at once. The proposed implementation order is in `docs/ARCHITECTURE.md`. The ideas are original; they borrow *patterns* from the inspiration apps, and do not copy characters, plots, or assets.

The world is shared by both girls. Each game has an age-2 variant (exploration, few choices, touch, audio and demonstration, can finish at any moment) and an age-5 variant (a task inside a story, several steps, an extra attribute or a changing rule). Age is the default track on the profile; ability in each domain and language is measured separately and does not automatically advance other domains.

The navigation shell is in Hebrew. In language games, the learning language for a round is English or French. In number and science games the instruction starts in Hebrew, unless the goal itself is vocabulary in a learning language.

### What is in the pilot and what is in the vision (updated after the reviews)

This table lives in this document, not only in the roadmap, so it does not look as if all 12 games are the near-term implementation scope.

| Stage | Scope | Status |
|---|---|---|
| P0 | Skeleton + map, Animal Restaurant at both age levels, leisure corner (bubbles), leisure engine and parent area | **proposal — pending owner approval**; this is the next step after architecture approval |
| P1 | One more game in the Language House (Travel Suitcase or Word Song) + a sort/drag template | After P0 is stable on the tablet |
| P2 | First Number Garden game (Picnic Train) | According to what the girls enjoyed |
| Vision | The remaining games and areas in this document | Not built all at once |

The two foundation templates for P0–P1: **choice/serve** and **sort/drag**. The rest are opened when there is a real need.

---

## The main map

The girl chooses an area on a small home island. The proposed areas:

| Area | Role | Earns leisure? |
|---|---|---|
| Language House | Understanding words and requests in English and French | Yes |
| Number Garden | Quantity, sorting, comparison | Yes, when the activity is marked educational |
| Nature Lab | Creatures, cause and effect, curiosity | Yes |
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

### 2. Travel Suitcase / Word Train

- **Stage:** P1 (one of two; both are not required in the same round).

- **Action:** A character is getting ready for a trip or a picnic and asks for items in the learning language; the girl puts them in the bag or in the carriage.
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

---

## Nature Lab

Goal: curiosity, naming in Hebrew and in the learning languages as needed, cause and effect. Inspiration: exploration without failure from Sago Mini / Pok Pok; a varied path (a short book + an activity) from Khan Academy Kids; short voice-guided tasks from Tiger eAcademy.

### 1. Who Lives Here?

- **Stage:** Vision (first candidate for the Nature Lab, after language and quantity learning are stable).

- **Action:** The girl helps an animal go home (nest, cave, water, tree) according to a voice hint or a picture.
- **Learning goal:** Matching a creature to a habitat, animal vocabulary.
- **Inspiration pattern:** Sago Mini (calm exploration, the world responds); Tiger eAcademy (short voice instruction).
- **Age 2:** Two animals and two homes, an immediate warm reaction even on a second try.
- **Age 5:** A descriptive hint ("I sleep in a cave" / "Je vis dans l'eau"), or several creatures in sequence.

### 2. Weather in the Window

- **Stage:** Vision.

- **Action:** The girl changes sun, rain, or wind and sees what happens to the plants, the puddle, or the laundry.
- **Learning goal:** Cause and effect, weather vocabulary, simple prediction.
- **Inspiration pattern:** Sago Mini (free play with no failure); Khan Academy Kids (short concrete science).
- **Age 2:** One switch — touch and see what happens, with no "right answer".
- **Age 5:** "What will happen if…", choosing suitable clothing, or two changes in sequence.

### 3. Little Nature Book

- **Stage:** Vision.

- **Action:** A short book with an interactive page: touch a creature, hear its name, move one element on the page.
- **Learning goal:** Naming, listening, a short story sequence.
- **Inspiration pattern:** Khan Academy Kids (a book + an activity on the same path); Lingokids (words with a fixed character).
- **Age 2:** Two or three pages, free touching, can leave on any page.
- **Age 5:** A small question at the end of the story, or a learning-language word next to the picture.

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

### 2. Kitchen Orchestra / Sound Lab

- **Stage:** Vision.

- **Action:** Touching utensils or creatures plays sounds; a short pattern can be repeated.
- **Learning goal:** Cause and effect, listening to a pattern, imitating a short sequence.
- **Inspiration pattern:** Sago Mini (free exploration); Tiger eAcademy (a short guided sequence, in the older-girl version).
- **Age 2:** Free playing with no failure.
- **Age 5:** Repeat a sequence of two or three sounds, or choose an instrument by name in the learning language.

### 3. Bubbles and Dreams (also as leisure)

- **Stage:** P0 as the leisure corner.

- **Action:** Touching bubbles, a joyful pop, changing colors. Exists in the spirit of the prototype.
- **Learning goal:** Secondary; mainly regulation, enjoyment, and a calm ending.
- **Inspiration pattern:** Leisure inside the app, like a free-play corner and not like a lesson.
- **Age 2 and 5:** The same activity, with different density and complexity. If this is a leisure corner — it does not earn new time.

---

## What is not built in the pilot

**proposal — pending owner approval.** Kept for the broader vision: systematic Hebrew reading and writing, physics and chemistry, AI and systems understanding, control of device content, and age 6–9 tracks. Here too we will not copy content from the inspiration apps, and we will not add ads, purchases, or a cloud account.

World characters will be original and consistent (kitchen, garden, lab, studio), so the girls recognize them from the map to the game. Character and style choices are a **proposal — pending owner approval**.
