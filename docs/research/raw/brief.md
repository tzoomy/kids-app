# Research brief: 2 adaptive games per world (kids learning PWA)

You are an independent researcher. Work alone; do not edit any files except writing your final answer to stdout. Reference files in the current directory: WORLDS.md (world map), ARCHITECTURE.md (tech + templates), vision-summary.md (Hebrew vision).

Product: Hebrew-UI educational PWA (Phaser 3, offline) on an Android tablet for two girls aged 2 and 5. Teach English, strengthen French (family language). Kids earn in-app leisure time by playing learning games; ENJOYMENT is the key quality bar. Inspirations: Tiger eAcademy, Lingokids, Sago Mini, Khan Academy Kids. Existing world/game: Animal Restaurant (Language House) on a "choice/serve" template (an animal asks for food out loud in EN/FR, child picks the right plate; age 2 = 2 choices, age 5 = 3-4 choices + quantities). Planned second template: "sort/drag". New worlds will first ship with device TTS voice and basic animation to validate the idea, then get polished.

HARD REQUIREMENT: every game must ADAPT difficulty to the child's answers.

Tasks:
1. Worlds (from WORLDS.md, excluding the Leisure Corner): Language House (Restaurant exists — propose 2 NEW games), Number Garden, Nature Lab, Art Studio. For the Restaurant, add short adaptive-difficulty upgrade notes only.
2. Research existing kids apps (Lingokids, Khan Academy Kids, Sago Mini, Toca Boca, Duolingo ABC, Endless Alphabet, Gus on the Go, Montessori apps, PBS Kids, Pok Pok, DragonBox, etc.) and research evidence: early-childhood L2 vocabulary (picture-word matching, TPR, songs), spaced retrieval for young kids, adaptive difficulty / zone of proximal development / dynamic difficulty adjustment, age 2 vs 5 abilities (motor control, attention span, pre-reading), touchscreen learning in toddlers.
3. For EACH world propose exactly 2 games: name (Hebrew + English); core mechanic (1-2 sentences); what it teaches (EN/FR vocab, concepts); age 2 vs age 5 play; concrete adaptive rules (signals: accuracy, response time, hints used; levers: number of choices, distractor similarity, item set, speed, audio-only vs picture support; e.g. 3 correct in a row -> level up, 2 misses -> level down); inspiring app; basic-version effort (S/M/L); template reuse (choice/serve, sort/drag, or new) — prefer reuse.
4. Build-order recommendation (short) and a shared adaptive-difficulty engine spec (per-child, per-skill mastery in localStorage) in a few bullets.

SOURCES: cite only real sources with full URLs that you actually opened/found via search. Never invent a URL or a citation. End with a "Sources" list.

Output: a single Markdown document in English, concise (aim for ~1500-2500 words), printed as your final answer.
