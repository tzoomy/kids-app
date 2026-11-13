<!-- Raw output: Antigravity CLI (agy), model gemini-4-argon-high, run 2026-11-11 22:29 Asia/Jerusalem, same brief as claude-games.md. Not edited; file:// links point to the researcher's scratch copies of repo docs. -->

# Research Brief: Adaptive Game Design Across Four Learning Worlds

This research brief defines the adaptive upgrade for **Animal Restaurant**, synthesizes empirical literature and commercial app mechanics, specifies **two adaptive games per world** across the four educational worlds defined in [WORLDS.md](file:///workspace/kids-app/research/WORLDS.md#L24-L35), and outlines a shared client-side adaptive engine aligned with [ARCHITECTURE.md](file:///workspace/kids-app/research/ARCHITECTURE.md#L10-L23) and [vision-summary.md](file:///workspace/kids-app/research/vision-summary.md#L33-L58).

---

## 1. Research Synthesis: Apps & Developmental Evidence

### 1.1 Commercial App Analysis: Mechanics & Adaptation Patterns

| App | Core Mechanics | Adaptation & Scaffolding Pattern | Key Takeaway for Our PWA |
| :--- | :--- | :--- | :--- |
| **Tiger eAcademy** ([eacademy.kids](https://eacademy.kids/)) | Voice-guided micro-tasks, clear visual progress bars, immediate character feedback. | Linear topic progression with spoken prompts and visual demonstrations on hesitation. | Use warm, explicit voice guidance and visible milestone feedback so children always know what to do without reading. |
| **Lingokids** ([lingokids.com](https://lingokids.com/)) | Thematic mini-games ("Playlearning"), catchy character songs, scavenger-hunt taps, object sorting. | Real-time performance tracking scales distractor count and recycles missed vocabulary across different game formats. | Combine rhythmic/musical word exposure with interactive tap-on-cue mechanics and cross-game vocabulary recycling. |
| **Sago Mini** ([sagomini.com](https://sagomini.com/)) | Open-ended roleplay (feeding friends, packing suitcases, dressing up) with expressive reactions. | Child-paced, failure-free exploration ("low floor"); objects respond playfully regardless of order. | Frame every quiz or sorting prompt as helping an endearing character complete a real-world routine (serving food, packing a bag). |
| **Khan Academy Kids** ([khanacademy.org](https://www.khanacademy.org/)) | Guided path mixing short interactive books, sorting, counting, and phonics with animal guides (Kodi). | Dynamic learning path adjusts level (Preschool to Grade 2) by skill mastery while allowing free selection in the library. | Separate per-skill mastery (EN vocab, FR vocab, numeracy, logic) from the child's chronological age profile. |
| **Pok Pok** ([playpokpok.com](https://playpokpok.com)) & **Toca Boca** | Montessori-inspired digital toys and open sandboxes; physics-based cause-and-effect with zero timers. | "Low floor, high ceiling" intrinsic adaptation: a 2-year-old taps for sensory reactions; a 5-year-old experiments with multi-step chains. | In Nature Lab and Art Studio, let age-2 play remain exploratory while layering goal-directed challenges for age 5. |
| **DragonBox Numbers** ([dragonbox.com](https://dragonbox.com)) | Direct manipulation of Cuisenaire-rod-like characters ("Nooms")—stacking, slicing, and balancing. | Conceptual scaffolding: starts with visual size comparison before introducing numerals or arithmetic equations. | Teach quantity and composition visually (train seats, balance scales) before displaying written numerals. |
| **Endless Alphabet**, **Duolingo ABC** ([abc.duolingo.com](https://abc.duolingo.com)), **Gus on the Go** ([gusonthego.com](https://www.gusonthego.com)) | Kinesthetic puzzles with self-correcting slots (Endless), micro-step scaffolding (Duolingo), map-based vocab mini-games (Gus). | Montessori "control of error" (wrong pieces bounce back gently without penalty) + spaced review of weak items. | Use self-correcting drop zones and playful semantic animations when a word is completed. |
| **PBS Kids Games** ([pbskids.org/games](https://pbskids.org/games)) | Character-led stealth learning (sorting habitats, dressing for weather, musical patterns). | Encouraging verbal hints on error ("Let's look at the wings!") rather than negative buzzer sounds. | Replace failure states with scaffolded hints (audio repeat → visual wiggle → elimination of a distractor). |

### 1.2 Empirical Evidence for Ages 2 and 5

1. **Early-Childhood L2 Vocabulary on Touchscreens (Dual-Coding & Enacted TPR):**
   - **Active, Contingent Interaction:** Following Hirsh-Pasek et al. (2015), young children learn best from apps that are active, engaged, meaningful, and free of extraneous "hotspot" distractions. Dual-coding (simultaneous unambiguous illustration + native-quality L2 audio + physical touch) enables two-year-olds to acquire receptive and expressive vocabulary from tablet games (Walter-Laager et al., 2017).
   - **Technology-Enhanced Total Physical Response (TE-TPR):** Grounding L2 requests (*"Put the coat in the bag"*, *"Donne-moi deux pommes"*) in purposeful screen actions (tapping to serve, dragging to dress or pack) activates sensorimotor memory traces and bridges receptive comprehension before requiring spoken production.
2. **Spaced Retrieval Practice in Early Childhood:**
   - **Active Retrieval Beats Passive Exposure:** Studies by Leonard, Karpicke, et al. (2019, 2022, 2024) demonstrate that prompting preschoolers to actively retrieve newly introduced words across spaced intervals yields significantly stronger retention of word forms and meanings than repeated passive listening.
   - **Expanding Schedules Build Early Confidence:** Testing a newly introduced word immediately (1–2 trials later) and then expanding the interval across subsequent rounds and sessions maximizes retrieval success without inducing frustration.
3. **Adaptive Difficulty, ZPD, and Dynamic Difficulty Adjustment (DDA):**
   - **Maintaining the Zone of Proximal Development (ZPD):** Adaptive practice models such as *Math Garden* (Klinkenberg, Straatemeier, & van der Maas, 2011) show that targeting an ~75%–85% success rate keeps children in flow.
   - **Preventing the "Seesaw Effect":** Micro-DDA (within a 5-round session) must use smooth, multi-dimensional levers—adjusting visual scaffolding, distractor similarity, and choice count—while macro-adaptation updates persistent skill ratings across sessions. Crucially, per [vision-summary.md](file:///workspace/kids-app/research/vision-summary.md#L47-L51), **leisure-time earning must reward participation time (including thinking, errors, and hints)**, completely decoupled from difficulty level or accuracy.
4. **Age 2 vs. Age 5 Motor Control, Prompts, and Attention Span:**
   - **Touch Mechanics (Aziz et al., 2014):** Only ~27% of 2-year-olds execute precise localized taps reliably, and sustained single-finger drag-and-drop is biomechanically difficult under age 3. Five-year-olds reliably execute drag-and-drop, multi-attribute sorting, and sequential taps. Therefore, **every `sort/drag` game must support tap-to-place (or auto-snap on touch) for the age-2 track**, while offering full drag-and-drop and multi-step rules for age 5.
   - **Prompt Comprehension (Hiniker et al., 2015):** Children under 3 struggle to interpret abstract UI icons (e.g., flashing arrows) and require explicit animated modeling (a hand demonstrating the action) or co-playing adult scaffolding. By age 5, children readily translate spoken instructions and visual cues into multi-step actions.

---

## 2. World-by-World Adaptive Game Specifications

All games reuse two core Phaser templates from [ARCHITECTURE.md](file:///workspace/kids-app/research/ARCHITECTURE.md#L69-L71)—**`choice/serve`** and **`sort/drag`**—with lightweight parameter flags.

### World 1: Language House (בית השפות)

#### Existing Flagship Upgrade: מסעדת החיות / Animal Restaurant
Currently built on `choice/serve` ([WORLDS.md](file:///workspace/kids-app/research/WORLDS.md#L45-L53)). To make it fully adaptive across Difficulty Tiers 1–5:
- **Signals tracked per prompt:** `isFirstTryCorrect`, `responseTimeMs` (measured from audio prompt completion), `hintsUsed` (audio repeat or visual wiggle), and item-level `masteryScore`.
- **Adaptive levers:**
  - *Tier 1 (Age 2 Entry):* 2 choices from visually distinct categories (e.g., red `apple` vs. yellow `cheese`), target item pulses gently after 4s of hesitation, single noun prompt (*"An apple, please!"* / *"Une pomme, s'il te plaît !"*).
  - *Tier 2:* 2–3 choices, no initial visual cue, introduces 1 spaced-review word alongside 1–2 familiar words.
  - *Tier 3 (Age 5 Entry):* 3 choices with semantic/visual similarity (e.g., `apple`, `strawberry`, `pear`), full polite request sentence.
  - *Tier 4:* 4 choices + **attribute or quantity modifier** (*"Two red apples"* / *"Deux pommes rouges"*), requiring the child to tap the item the requested number of times onto the tray before tapping Serve.
  - *Tier 5 (Mastery):* 4 choices + **compound two-item order** (*"Milk and a banana"* / *"Du lait et une banane"*) or audio-first delay (plates appear 1.5s *after* the animal finishes speaking to train pure auditory comprehension).
- **Transition rules:** **3 consecutive first-try correct answers** (`responseTimeMs < 5000`, `hintsUsed == 0`) $\rightarrow$ advance +1 tier; **2 errors in 3 prompts** or **2 auto-demonstrations** $\rightarrow$ drop -1 tier and spawn a high-mastery anchor item next.

---

#### New Game 1.1: מזוודת המסע / Travel Suitcase
- **Core Mechanic:** A character preparing for a trip (beach, snowy mountain, or picnic) asks in EN/FR for clothing or gear to pack into an open suitcase or train carriage. The child moves the requested item(s) from the wardrobe shelf into the suitcase, triggering a funny dress-up or packing animation.
- **What It Teaches:** EN/FR vocabulary for clothing (`hat/chapeau`, `shoes/chaussures`, `coat/manteau`, `glasses/lunettes`), everyday objects (`ball/ballon`, `book/livre`), weather-appropriate gear, colors, and action verbs (*"Put in..."* / *"Mets..."*).
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 2 large items on the shelf; **tap-to-pack** (tapping an item smoothly tweens it into the suitcase without requiring drag precision). Animated hand demonstrates after 5s of inactivity.
  - **Age 5:** 3–5 items on the shelf; **drag-and-drop** into the suitcase; introduces color/size adjectives (*"the blue hat"* / *"le chapeau bleu"*), two-item sequences, and negation at high tiers (*"A hat, NOT the red one!"* / *"Un chapeau, mais PAS le rouge !"*).
- **Concrete Adaptive Rules:**
  - *Signals:* First-try pack accuracy, drag/tap latency (`responseTimeMs`), wrong-item drops (bounces back gently with a friendly hint), Hebrew help button taps.
  - *Levers:* Shelf size (2 $\rightarrow$ 5 items), distractor similarity (distinct items $\rightarrow$ same item in different colors/sizes), linguistic complexity (single noun $\rightarrow$ noun + color $\rightarrow$ negation/exclusion).
  - *Thresholds:* `3 correct in a row (<5s, 0 hints)` $\rightarrow$ increase shelf count by 1 or add attribute/negation modifier; `2 wrong drops on a single prompt` $\rightarrow$ highlight target item with a bounce tween and step down 1 tier on the next round.
- **Inspiring App:** Sago Mini (*Suitcase / Vacation*) + Lingokids (clothing sorting).
- **Basic-Version Effort:** **S** (ships in P1 alongside the `sort/drag` template).
- **Template Reuse:** **`sort/drag`** (configured with 1 target container in basic tiers, 2 containers—e.g., *Mine* vs. *Friend's*—in advanced tiers).

---

#### New Game 1.2: במת השירים / Word Song Stage
- **Core Mechanic:** A house character performs a short, catchy 2-to-4-line rhythmic chant or song in EN/FR while 2–4 illustrated stage props/cards float above the stage. At the musical pause (or target word beat), the child taps the prop matching the sung word to make the character dance and finish the verse.
- **What It Teaches:** EN/FR phonological rhythm, action verbs (`jump/sauter`, `clap/applaudir`, `sleep/dormir`), body parts (`hands/mains`, `nose/nez`), and animals through musical repetition and TE-TPR.
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** Very short 2-line chant repeating one target word twice (*"Clap, clap, clap your hands!"* / *"Tape, tape, tape des mains !"*); 2 props on screen; no time limit at the pause—the character waits smilingly until tapped.
  - **Age 5:** 4-line rhyming verse with 3–4 props; asks the child to catch 2 sequential target words across the verse or complete a rhyming/semantic cloze at the end of the line.
- **Concrete Adaptive Rules:**
  - *Signals:* Tap accuracy on the target beat/pause, latency after the sung cue, number of verse replays needed.
  - *Levers:* Number of prop choices (2 $\rightarrow$ 4), visual scaffolding (prop pulses in rhythm with the word at Tier 1 $\rightarrow$ static props at Tier 3 $\rightarrow$ props flip face-up only after the line is sung at Tier 5), number of target words per verse (1 $\rightarrow$ 3).
  - *Thresholds:* `3 consecutive verses completed on first try` $\rightarrow$ remove rhythmic pulse scaffold and add +1 prop choice; `2 missed taps` $\rightarrow$ replay the sung word in isolation with a spotlight on the correct prop and reduce choices by 1.
- **Inspiring App:** Lingokids (character songs) + Tiger eAcademy (voice-accompanied rhythm tasks).
- **Basic-Version Effort:** **S** (reuses existing `choice/serve` mechanics with rhythmic audio phrasing).
- **Template Reuse:** **`choice/serve`** (with an audio-cue marker hook).

---

### World 2: Number Garden (גינת המספרים)

#### Game 2.1: רכבת הפיקניק / Picnic Train
- **Core Mechanic:** Animal passengers sit in train carriages waiting for picnic supplies (berries, sandwiches, tickets). Guided in Hebrew (with optional EN/FR counting out loud as each item lands: *"One, two, three!"* / *"Un, deux, trois !"*), the child distributes items so every passenger or carriage has the exact needed amount before the train departs.
- **What It Teaches:** One-to-one correspondence, subitizing and counting (1–10), "how many are missing" (early subtraction/complement), equal sharing, and EN/FR number words.
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 1 carriage with 2–3 passengers; **1-to-1 matching** (give 1 berry to each animal by tapping). Each animal counts out loud and munches happily.
  - **Age 5:** 1–2 carriages with partially filled plates; solves **"how many more are needed"** (e.g., 5 passengers, 2 already have hats $\rightarrow$ drag 3 more hats) or distributes $N$ items equally between 2 carriages before pressing the departure whistle.
- **Concrete Adaptive Rules:**
  - *Signals:* Over-giving or under-giving before tapping the train whistle (Age 5), tap/drag errors, response time, hint requests.
  - *Levers:* Quantity range (1–2 $\rightarrow$ 1–3 $\rightarrow$ 1–5 $\rightarrow$ 6–10), visual slot scaffolding (outlined ghost slots showing exact missing items at Tiers 1–2 $\rightarrow$ no ghost slots at Tiers 3–5), task type (1-to-1 matching $\rightarrow$ counting total $\rightarrow$ missing addend $A + ? = B$).
  - *Thresholds:* `3 consecutive trains dispatched without over/under-count` $\rightarrow$ remove ghost outlines or increase max quantity by +2; `2 incorrect whistle checks or 2 hints` $\rightarrow$ re-enable ghost outlines and lower quantity range.
- **Inspiring App:** Khan Academy Kids (contextual counting) + Sago Mini (*Train*).
- **Basic-Version Effort:** **M** (P2 milestone in [WORLDS.md](file:///workspace/kids-app/research/WORLDS.md#L81-L89)).
- **Template Reuse:** **`sort/drag`** (extended with a slot counter and optional "Depart/Check" button for Age 5).

---

#### Game 2.2: ערוגות המיון / Sorting Beds
- **Core Mechanic:** Colorful flowers, leaves, and garden veggies have tumbled onto the garden path. The child sorts them into 2 or 3 garden beds according to a visual sign and voice rule (by color, shape, size, or count), watching the beds bloom when filled.
- **What It Teaches:** Categorization by single and multiple attributes (color, shape, size), cognitive flexibility (rule-switching), visual comparison, and EN/FR color/size adjectives (`big/grand`, `small/petit`).
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 2 garden beds sorting by **1 salient attribute** (e.g., Red vs. Yellow flowers); tapping an item and tapping a bed (or rough drag) snaps it in; wrong bed gently shakes its head and points to the matching bed (Montessori control of error).
  - **Age 5:** 2–3 garden beds sorting by **2 combined attributes** (e.g., *Small Red* vs. *Big Red* vs. *Blue*) or **mid-round rule switch** (Executive Function challenge: *"Now the mole wants sorted by SIZE instead of color!"*).
- **Concrete Adaptive Rules:**
  - *Signals:* Sorting accuracy per item, error streak after a rule switch, latency per placement.
  - *Levers:* Number of beds (2 $\rightarrow$ 3), attribute dimensionality (1 attribute $\rightarrow$ 2 attributes $\rightarrow$ mid-round rule switch), visual label support on beds (explicit matching icon $\rightarrow$ abstract symbol $\rightarrow$ spoken rule in EN/FR/HE only).
  - *Thresholds:* `4 items sorted without error (<3.5s/item)` $\rightarrow$ introduce a second attribute or trigger a playful mid-round rule switch; `2 consecutive mis-sorts` $\rightarrow$ highlight the matching bed border and revert to single-attribute sorting.
- **Inspiring App:** Montessori sorting apps + PBS Kids + Tiger eAcademy.
- **Basic-Version Effort:** **S** (pure application of the `sort/drag` template).
- **Template Reuse:** **`sort/drag`**.

---

### World 3: Nature Lab (מעבדת הטבע)

#### Game 3.1: מי גר כאן? / Who Lives Here?
- **Core Mechanic:** Friendly creatures (frog, bird, bear, fish, bee) appear in the Nature Lab doorway with an audio/visual clue. The child guides each creature to its natural habitat zone on the lab panorama (pond, tree nest, cave, beehive), triggering an animated habitat reaction and learning the creature and habitat names in HE and EN/FR.
- **What It Teaches:** Animal-to-habitat matching, biological traits (wings, fins, hibernation), and bilingual nature vocabulary (`bird/oiseau`, `water/eau`, `tree/arbre`, `fish/poisson`).
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 2 habitats visible (e.g., Tree Nest and Water Pond); creature makes its signature sound and movement; child taps the habitat to send the animal home.
  - **Age 5:** 3–4 habitats; clues shift from direct naming to **descriptive riddles in HE/EN/FR** (*"I have fins and swim—where do I live?"* / *"Je nage dans l'eau—où est ma maison ?"*) or sorting food/footprints to the right creature's home.
- **Concrete Adaptive Rules:**
  - *Signals:* First-try habitat match, hint usage (tapping the magnifying glass for a visual clue), response time.
  - *Levers:* Number of habitats on screen (2 $\rightarrow$ 4), clue abstraction (direct visual peek inside habitat $\rightarrow$ animal name in EN/FR $\rightarrow$ trait/riddle audio clue without visual peek), distractor habitats (visually distinct $\rightarrow$ similar ecosystems like pond vs. ocean).
  - *Thresholds:* `3 correct matches in a row without peeking` $\rightarrow$ upgrade clue from direct name to descriptive riddle and show 4 habitats; `2 misses` $\rightarrow$ play a visual peek animation inside the correct habitat and reduce to 2–3 choices.
- **Inspiring App:** Sago Mini (*Forest / Ocean*) + Khan Academy Kids (animal habitats).
- **Basic-Version Effort:** **S** (reuses `sort/drag` / `choice/serve` directly).
- **Template Reuse:** **`sort/drag`** (or **`choice/serve`** where habitats are the choice targets).

---

#### Game 3.2: מזג אוויר בחלון / Weather in the Window
- **Core Mechanic:** Looking through a large interactive window onto the garden, the child controls weather switches (sun, rain, wind, snow) and selects items (umbrella, sunglasses, watering bucket, kite) to help the garden character and plants thrive in that weather.
- **What It Teaches:** Cause and effect (rain fills puddles and grows flowers; sun dries laundry; wind flies kites), prediction, and EN/FR weather & seasonal vocabulary (`sun/soleil`, `rain/pluie`, `wind/vent`, `cold/froid`, `hot/chaud`).
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** **Sandbox + 2-choice prompt:** Child taps weather switches freely to watch immediate cause-and-effect animations, followed by a gentle 2-choice prompt (*"It's raining! Tap the umbrella for Mimi"* / *"Il pleut ! Touche le parapluie"*).
  - **Age 5:** **Goal-directed prediction & two-step cause-and-effect:** The game sets a goal (*"The flower is thirsty and then needs sunshine to open!"* or *"Make the puddle freeze so Mimi can skate"*), requiring the child to select the right weather sequence and equip the character in EN/FR.
- **Concrete Adaptive Rules:**
  - *Signals:* Correct weather/item selection for the scenario, number of trial switches before solving a goal, hint requests.
  - *Levers:* Mode (1-step reactive choice $\rightarrow$ 1-step inverse prediction *"What weather do we need to dry the wet shirt?"* $\rightarrow$ 2-step weather sequence), choice count (2 $\rightarrow$ 4 items/switches), language prompt (Hebrew + EN/FR word $\rightarrow$ EN/FR sentence only).
  - *Thresholds:* `3 solved scenarios on first try` $\rightarrow$ advance from reactive dressing to 2-step weather prediction; `2 wrong selections` $\rightarrow$ animate the visual consequence of the choice (e.g., character shivers in shorts during snow) and highlight the correct switch/item.
- **Inspiring App:** Pok Pok / Toca Nature (cause-and-effect sandbox) + PBS Kids (*Weather* games).
- **Basic-Version Effort:** **M** (requires weather state animations on the shared window scene, built on `choice/serve`).
- **Template Reuse:** **`choice/serve`** (selecting weather switches and equipment items in response to scene states).

---

### World 4: Art Studio (סטודיו היצירה)

Per [WORLDS.md](file:///workspace/kids-app/research/WORLDS.md#L149-L152) and [ARCHITECTURE.md](file:///workspace/kids-app/research/ARCHITECTURE.md#L200), Art Studio supports both **free creation** (leisure mode) and **guided educational challenges** (which earn leisure credit and adapt to the child's responses).

#### Game 4.1: צובעים את העולם / Color the World
- **Core Mechanic:** An illustrated scene featuring characters and objects from the map appears with tap-to-fill regions and a palette of paint pots. In guided learning mode, the studio character requests specific colors or colored objects in HE/EN/FR (*"Let's paint the roof blue!"* / *"Peignons le toit en bleu !"*), then unlocks free decorating stickers once the guided prompts are completed.
- **What It Teaches:** Color recognition, color mixing (at upper tiers: red + yellow = orange), object-color binding in EN/FR (`red/rouge`, `blue/bleu`, `green/vert`, `yellow/jaune`), and fine-motor region selection.
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 3 giant regions on screen and 2–3 large paint pots; **1-step tap** (the requested color pot is pre-selected at Tier 1, or child taps from 2 pots and taps anywhere on the pulsing object—no "coloring outside the lines" error).
  - **Age 5:** 6–8 detailed regions and 4–6 paint pots; **2-step selection** (pick the named color pot + tap the named object in EN/FR: *"Color the small bird yellow"*), progressing to **primary color mixing** (combine two pots in the mixing bowl to create green/orange/purple).
- **Concrete Adaptive Rules:**
  - *Signals:* Accuracy of color-pot selection vs. region selection, time to locate the color, hint taps.
  - *Levers:* Palette size (2 $\rightarrow$ 6 pots), prompt complexity (color name only with region pre-highlighted $\rightarrow$ color + object name in EN/FR $\rightarrow$ color mixing required), visual hint on paint pots (character holds a matching colored brush at Tier 1 $\rightarrow$ audio-only color prompt at Tier 4).
  - *Thresholds:* `3 consecutive correct color+region fills (<5s)` $\rightarrow$ expand palette by +1 pot or introduce a two-attribute/color-mixing prompt; `2 wrong pot taps` $\rightarrow$ make the target paint pot bubble and splash with its color name repeated.
- **Inspiring App:** Sago Mini (*Coloring*) + Khan Academy Kids (guided coloring tasks).
- **Basic-Version Effort:** **M** (SVG/sprite-region tinting layered onto `choice/serve`).
- **Template Reuse:** **`choice/serve`** (extended with a 2-step `select-tool -> tap-target` state).

---

#### Game 4.2: תזמורת המטבח / Kitchen Orchestra
- **Core Mechanic:** Characters sit behind whimsical kitchen-and-studio instruments (wooden spoon drums, water-glass xylophone, bell shaker, horn). In guided mode, the conductor either calls out an instrument/sound attribute in EN/FR (*"Play the big drum quickly!"*) or plays a short audio-visual rhythm sequence for the child to echo by tapping the instruments.
- **What It Teaches:** Auditory working memory (pattern imitation), sound attributes (fast/slow, loud/quiet, high/low), cause and effect, and EN/FR musical/kitchen vocabulary (`drum/tambour`, `bell/cloche`, `glass/verre`, `fast/vite`, `slow/lentement`).
- **Age 2 vs. Age 5 Play:**
  - **Age 2:** 2–3 large instruments; **1-note echo or direct call** (*"Tap the bell!"* / *"Touche la cloche !"*); tapping triggers joyful musical riffs and dancing utensils with zero failure state.
  - **Age 5:** 4–5 instruments; alternates between **auditory memory sequences** (2 $\rightarrow$ 4 notes, Simon-style) and **multi-attribute EN/FR conductor requests** (*"Tap the glass two times!"* / *"Touche le verre deux fois !"*).
- **Concrete Adaptive Rules:**
  - *Signals:* Sequence reproduction accuracy, order errors vs. instrument-identity errors, replay-prompt usage.
  - *Levers:* Sequence length (1 note $\rightarrow$ 2 notes $\rightarrow$ 3 notes $\rightarrow$ 4 notes), instrument count (2 $\rightarrow$ 5), visual memory support (instruments stay lit with numbered badges `1-2` during playback at Tier 2 $\rightarrow$ light up briefly $\rightarrow$ audio-only echo with eyes closed at Tier 5).
  - *Thresholds:* `3 sequences echoed accurately on first try` $\rightarrow$ increase sequence length by +1 or fade visual light-up cue; `2 sequence errors` $\rightarrow$ replay pattern 25% slower with persistent visual glow and reduce sequence length by -1 (minimum 1).
- **Inspiring App:** PBS Kids (*Daniel Tiger / Peg + Cat Music*) + Tiger eAcademy (guided memory sequences).
- **Basic-Version Effort:** **S** (uses `choice/serve` with sequential tap validation and Web Audio / MP3 SFX).
- **Template Reuse:** **`choice/serve`** (with a target array `[item1, item2, ...]`).

---

## 3. Build-Order Recommendation & Shared Adaptive Engine Spec

### 3.1 Recommended Build Order

Because all 8 proposed games reuse **`choice/serve`** and **`sort/drag`**, we can validate every world early using pre-generated TTS audio (`scripts/tts/generate_voice.py` per [ARCHITECTURE.md](file:///workspace/kids-app/research/ARCHITECTURE.md#L159)) and Phaser tweens:

1. **P0 (Foundation + Flagship Upgrade):** Ship the Vite/TS/Phaser shell, Leisure Engine, and **Animal Restaurant** (`choice/serve`) upgraded with the shared Adaptive Engine (Tiers 1–5).
2. **P1 (Language House Expansion + Second Template):** Build the generic **`sort/drag`** template (supporting both Age-2 tap-to-place and Age-5 drag-and-drop) and ship **Travel Suitcase** (`sort/drag`) + **Word Song Stage** (`choice/serve`).
3. **P2 (Number Garden):** Ship **Sorting Beds** (immediate reuse of `sort/drag`, Effort S) followed by **Picnic Train** (`sort/drag` + quantity counter, Effort M).
4. **P3 (Nature Lab & Art Studio MVP):** Ship **Who Lives Here?** (`sort/drag`, Effort S) and **Kitchen Orchestra** (`choice/serve` sequence, Effort S) to open both new worlds quickly, then follow with **Color the World** (Effort M) and **Weather in the Window** (Effort M).

---

### 3.2 Shared Adaptive-Difficulty Engine Spec (`src/core/adaptive/`)

Designed as a pure TypeScript module alongside `src/core/leisure/` and `src/core/storage/` ([ARCHITECTURE.md](file:///workspace/kids-app/research/ARCHITECTURE.md#L62-L65)), with zero Phaser dependency and full Vitest coverage:

- **Per-Child, Per-Skill, Per-Language State in `localStorage`:**
  - Keyed under `kids_app_adaptive_v1[profileId]` (`schemaVersion: 1`).
  - Tracks two levels of state:
    1. **Skill Tier (`skills["language-house:food:en"]`):** `{ tier: 1..5, streak: number, rollingAccuracy: number[], updatedAt: number }`. Default starting tier is `1` for the age-2 profile and `3` for the age-5 profile, but each skill/language evolves independently.
    2. **Item Mastery & Spaced Retrieval Queue (`items["en:apple"]`):** `{ box: 1..4, ease: number, lastSeenRound: number, nextDueTimestamp: number, exposures: number, independentSuccesses: number }`.
- **In-Session Micro-DDA Ladder (Tiers 1–5):**
  - After every prompt, the template emits `recordAttempt({ skillId, lang, itemId, correctFirstTry, responseTimeMs, hintsUsed })`.
  - **Level-Up Rule:** `streak >= 3` where each attempt had `correctFirstTry === true`, `hintsUsed === 0`, and `responseTimeMs < targetTimeForAge` (e.g., 6000ms for Age 2, 4500ms for Age 5) $\rightarrow$ `tier = Math.min(5, tier + 1)` and reset `streak = 0`.
  - **Level-Down & Frustration Guard:** `2 incorrect first-tries in last 3 prompts` OR `auto-demonstration triggered` $\rightarrow$ `tier = Math.max(1, tier - 1)`, reset `streak = 0`, and force the next prompt to pull a high-mastery (`box >= 3`) item to restore confidence.
- **Spaced Retrieval Item Selector (`selectNextRoundItems`):**
  - Implements an expanding Leitner schedule inspired by Leonard et al. (2019, 2024):
    - **Missed item:** Re-queued **2 prompts later** within the same session (immediate expanding retrieval) with visual scaffolding enabled, and reset to `box = 1`.
    - **Round composition (5 prompts/round):** **60% due/learning items** (`box 1–2`), **20% new item** (at most 1 new word introduced per round so cognitive load stays low), and **20% mastered review** (`box 3–4`, ensuring easy success and cross-session retention).
- **Strict Separation from Leisure Earning:**
  - The Adaptive Engine never deducts or slows down leisure credit in `src/core/leisure/`. A child on Tier 1 using hints and taking 8 seconds to think earns the exact same participation credit per minute as a child on Tier 5 answering in 2 seconds.
  - To satisfy the anti-farming rule in [vision-summary.md](file:///workspace/kids-app/research/vision-summary.md#L53), the Adaptive Engine automatically mixes due and new items into repeated sessions of a favorite game so the child naturally progresses while playing what she loves.

---

## 4. Sources

### Academic Research & Empirical Evidence
1. **Hirsh-Pasek, K., Zosh, J. M., Golinkoff, R. M., Gray, J. H., Robb, M. B., & Kaufman, J. (2015).** *Putting Education in "Educational" Apps: Lessons From the Science of Learning.* Psychological Science in the Public Interest, 16(1), 3–34. DOI: https://doi.org/10.1177/1529100615569721 | URL: https://journals.sagepub.com/doi/10.1177/1529100615569721
2. **Walter-Laager, C., Brandenberg, K., Tinguely, L., Schwarz, J., Pfiffner, M. R., & Moschner, B. (2017).** *Media-assisted language learning for young children: Effects of a word-learning app on the vocabulary acquisition of two-year-olds.* British Journal of Educational Technology, 48(4), 1062–1072. DOI: https://doi.org/10.1111/bjet.12472 | URL: https://onlinelibrary.wiley.com/doi/abs/10.1111/bjet.12472
3. **Leonard, L. B., Karpicke, J., Deevy, P., Weber, C., Christ, S., Haebig, E., & Souto, S. (2019).** *Retrieval-Based Word Learning in Young Typically Developing Children and Children With Developmental Language Disorder I: The Benefits of Repeated Retrieval.* Journal of Speech, Language, and Hearing Research, 62(4), 932–943. DOI: https://doi.org/10.1044/2018_JSLHR-L-18-0070 | URL: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6802889/
4. **Leonard, L. B., Kueser, J. B., Deevy, P., Haebig, E., Karpicke, J. D., & Weber, C. (2022).** *The contributions of immediate retrieval and spaced retrieval to word learning in preschoolers with developmental language disorder.* Autism & Developmental Language Impairments, 7. DOI: https://doi.org/10.1177/23969415221088926 | URL: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8978184/
5. **Leonard, L. B., Christ, S. L., Deevy, P., Karpicke, J., & Kueser, J. B. (2024).** *Retrieval Practice and Word Learning by Children With Developmental Language Disorder: Does Expanding Retrieval Provide Additional Benefit?* Journal of Speech, Language, and Hearing Research, 67(5), 1530–1545. DOI: https://doi.org/10.1044/2024_JSLHR-23-00528 | URL: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11087082/
6. **Klinkenberg, S., Straatemeier, M., & van der Maas, H. L. J. (2011).** *Computer adaptive practice of Maths ability using a new item response model for on the fly ability and difficulty estimation.* Computers & Education, 57(2), 1813–1824. DOI: https://doi.org/10.1016/j.compedu.2011.02.003 | URL: https://www.sciencedirect.com/science/article/pii/S0360131511000418
7. **Aziz, N. A. A., Sin, N. S. M., Batmaz, F., Stone, R., & Chung, P. W. H. (2014).** *Selection of Touch Gestures for Children's Applications: Repeated Experiment to Increase Reliability.* International Journal of Advanced Computer Science and Applications (IJACSA), 5(4), 97–102. DOI: https://doi.org/10.14569/IJACSA.2014.050415
8. **Hiniker, A., Sobel, K., Hong, S. R., Suh, H., Irish, I., Kim, D., & Kientz, J. A. (2015).** *Touchscreen Prompts for Preschoolers: Designing Developmentally Appropriate Techniques for Teaching Young Children to Perform Gestures.* Proceedings of the 14th International Conference on Interaction Design and Children (IDC '15), 109–118. DOI: https://doi.org/10.1145/2771839.2771851

### Commercial Educational Apps & Platforms Referenced
9. **Tiger eAcademy:** https://eacademy.kids/
10. **Lingokids:** https://lingokids.com/
11. **Sago Mini (World & School):** https://sagomini.com/
12. **Khan Academy Kids:** https://www.khanacademy.org/
13. **Pok Pok:** https://playpokpok.com
14. **DragonBox Numbers:** https://dragonbox.com
15. **Duolingo ABC:** https://abc.duolingo.com
16. **Gus on the Go:** https://www.gusonthego.com
17. **PBS Kids Games:** https://pbskids.org/games
