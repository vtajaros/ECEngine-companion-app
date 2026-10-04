# Todo & Status

- [x] **Learn mode not working in looksfam, flashcards, formulas (fixed)**:
  - Root cause: `src/services/db.service.ts` in `getAllCardsByTopic` had `FROM cards` without table alias `c`, but selected `${tosCol}` as `'c.tos_topic_id'`. SQLite threw `no such column: c.tos_topic_id`.
  - In contrast, TestMode and PrintView (TestPaperView) worked because they query via `getCardsWithProgress` which properly aliases `FROM cards c`.
  - Fix: Aliased `FROM cards c` with `c.*` in `getAllCardsByTopic`.

- [x] **Diagnose and optimize Gauntlet performance & review summary transition (completed via /grill-me)**:
  - **Render Churn**: Isolated question and choices rendering inside `QuestionView` via `React.memo` so 250ms timer countdown ticks do not re-render heavy KaTeX math nodes.
  - **Desktop Effects (Hardware-Accelerated CSS)**:
    - Wrong answer card shake (`gauntlet-card-shake`, 250ms).
    - Red edge flash overlay on card (`gauntlet-edge-flash`, 350ms).
    - Survival heart pulse on life lost (`gauntlet-heart-pulse`, 400ms).
    - Urgent timer pulse/shake (`gauntlet-timer-shake`) when remaining time <= 5s.
  - **Review Summary Transition**:
    - Replaced expensive mobile `backdrop-blur-md` with GPU-friendly opaque dark surface (`bg-neutral-950`).
    - Added smooth hardware-accelerated slide-up transition (`gauntlet-summary-slide-up`).
    - Lazy math rendering in Mistakes Breakdown: Clean plain-text preview when collapsed, compiling KaTeX only on-demand when expanded.
    - Non-blocking Capacitor Preferences storage recording.
    - Smooth audio transition to `combatOver` ambient music upon finishing run, fading out cleanly on exit.

- [x] **Gauntlet audio & UX Polish (completed)**:
  - **Music on entry**: Added `initGauntletAudio` to prewarm and unlock AudioContext synchronously during user gesture before async database query, avoiding Android autoplay policy suspension. Added fallback interaction listeners to resume audio.
  - **Screen lock/background pause**: Instantly sets `masterGain` to 0 and suspends AudioContext via both `visibilitychange` and Capacitor's `appStateChange`. Restores volume on return to foreground.
  - **LooksFam tab order**: Swapped order in `TopicBrowser` so LooksFam is the first tab on the bottom bar (`LooksFam | Flashcards | Formulas | Gauntlet`).
  - **Run It Back (fresh questions)**: Reshuffles deck on "Run It Back" so each replay has a fresh randomized question order matching desktop mode.
  - **Learn Missed & Learn All**: Replaced the single drill button in the review summary with two buttons: `LEARN MISSED (N)` and `LEARN ALL (N)`, properly wired to LooksFam mode in `App.tsx`.

- [x] **Learn Mode Ghost Highlight & Gauntlet Countdown Splash (completed)**:
  - **Learn Mode Ghost Highlight**: Card container and choice buttons are now keyed by card ID and index (`key={`${currentCard.id}-${currentCardIndex}-${idx}`}`). Previously `key={idx}` caused React to reuse the existing DOM button elements, causing Tailwind's `transition-all` to animate background and border colors from green/red back to neutral when the next question rendered. Fresh DOM nodes prevent any lingering animation.
  - **Gauntlet Countdown Splash (3-2-1-GO!)**: Added `GauntletCountdown` matching desktop animations with Web Audio API synthesized `tick` (sine 880Hz) and `go` beeps. The 2.4s countdown allows `gauntletbg.mp3` to fully decode into memory under stealth ambient audio before the first question and timers begin.

- [x] **Learn Mode Transitions, Audio Prewarm & Gauntlet Cleanup (completed)**:
  - **Learn Mode Question Transition**: Added smooth `fade in / fade out` + subtle vertical glide (160ms) using Framer Motion `AnimatePresence mode="wait"`, with automatic scroll-to-top on next question.
  - **First Question Lag / Audio Prewarming**: Added `prewarmSounds()` to fetch and decode `wrongSfx`, `gameOverSfx`, and `plusOneSfx` into memory during countdown/idle rather than on the first question trigger. Upgraded animation keyframes in `src/index.css` to 3D GPU transforms (`translate3d(0, 0, 0)`, `scale3d`, `backface-visibility: hidden`).
  - **Survival Pillbox & Option Theme**: Changed the Survival mode tab pillbox, per-question time presets, difficulty multiplier, and start button in `GauntletArcadeHome.tsx` from green to crimson red (`text-red-400`, `border-red-500/50`, `bg-[#ef4444]`), matching the header flame icon.
  - **Unified Sound Toggle**: Removed the redundant secondary music toggle button from the Gauntlet header, keeping a single unified `Volume2`/`VolumeX` toggle that silences all audio.

- [x] **Topic Focus Selection in Gauntlet (completed)**:
  - Added multi-chapter topic focus selection matching desktop ECEngine with mobile-first ergonomics.
  - **`GauntletTopicModal.tsx`**:
    - Modal sheet with Android back gesture/button interception (`CapacitorApp.addListener('backButton')`).
    - Sticky search input (`name`, `code`, or `subject`) with clear button.
    - Toggle between 34 Parent Topics (`x.0`) and 181 Granular Subtopics (`x.x`).
    - Subject filter pills (`ALL`, `MATH`, `GEAS`, `ELECS`, `EST`) with theme colors.
    - Bulk selection controls: `Select All / Tab`, `Deselect All / Tab`, and `Reset All`.
    - Single-column touch cards ($\ge 48$px touch target, custom neon checkbox, subject tag, code, and title).
    - Sticky bottom bar showing pool status (`All Topics (Pool)` vs `N Topics Selected`), `Cancel`, and glowing `Apply` button.
  - **Setup Screen & Subject Sync (`GauntletArcadeHome.tsx`)**:
    - "TOPIC FOCUS" card with pulsing status dot and `Filter Topics` / `Edit Topics` action.
    - Selected topic preview chips with subject badge, code, title, and individual remove (X) button.
    - Auto-merges selected topic subjects into active subjects pool.
    - Deselecting a subject toggle on setup automatically trims that subject's topics from the topic filter.
    - Dynamic pool counter updates (`dbService.getGauntletPoolSizes(config.tosTopicIds)`).
  - **Database & Session Filtering (`db.service.ts` & `App.tsx`)**:
    - `buildTosTopicClause` handles parent topic prefix matching (`c.tos_topic_id LIKE 'prefix.%'`) and granular subtopic matching (`c.tos_topic_id = ?`).
    - `getGauntletCards` and `getGauntletPoolSizes` query questions strictly from chosen topics.
    - Deployed and verified on connected Android device via ADB.

- [x] **Android Back Gesture on Survival / Time Trial Setup (completed)**:
  - Added Capacitor `backButton` hardware/gesture listener in [`GauntletArcadeHome.tsx`](file:///home/delata/Shared/Projects/ecengine_companion/src/components/gauntlet/GauntletArcadeHome.tsx).
  - Tapping Android back or swiping the back gesture now smoothly exits Survival / Time Trial setup and returns to the previous study mode (e.g. LooksFam, Flashcards, or Formulas) via `previousModeRef` in [`TopicBrowser.tsx`](file:///home/delata/Shared/Projects/ecengine_companion/src/pages/TopicBrowser.tsx).
  - If the Topic Focus Selection modal is open, the back gesture closes the modal first without exiting setup.
  - Successfully built, deployed, and launched on connected Android device.

- [x] **Table of Specifications (ToS) Topics Port to Companion (completed)**:
  - **Segmented View Mode Toggle**: Added `Custom Decks | ToS Topics` segmented toggle in LooksFam header in [`TopicBrowser.tsx`](file:///home/delata/Shared/Projects/ecengine_companion/src/pages/TopicBrowser.tsx).
  - **Virtual ToS Topics**: Derived all 181 decimal subtopics from [`tosClassification.ts`](file:///home/delata/Shared/Projects/ecengine_companion/src/lib/tosClassification.ts) enriched with card counts and mastery from SQLite DB.
  - **ToS Hierarchy Drawer**: Created [`TosTopicDrawer.tsx`](file:///home/delata/Shared/Projects/ecengine_companion/src/components/TosTopicDrawer.tsx) supporting collapsible subject roots (`MATH`, `GEAS`, `ELECS`, `EST`) and indented parent topics (`1.0`, `2.0`, etc.) when `activeSubject === 'ALL'`, and flattened parent topic list when a specific subject filter is active.
  - **Database Service Enhancements**: Added `getTosTopicStats()` in [`db.service.ts`](file:///home/delata/Shared/Projects/ecengine_companion/src/services/db.service.ts), and updated `getCardsWithProgress()`, `getCards()`, and `getAllCardsByTopic()` to natively support virtual `tos_*` topic IDs by querying `c.tos_topic_id`.
  - **Full Study Parity**: Learn Mode, Test Mode, and Test Paper View (PrintView) work seamlessly on all 181 ToS subtopics.
  - **Clean Build**: Verified TypeScript compilation and production bundle build with zero errors.