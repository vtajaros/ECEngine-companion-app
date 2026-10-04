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