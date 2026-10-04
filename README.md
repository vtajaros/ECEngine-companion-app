# ECEngine Companion

A portable Android companion to **ECEngine**, an offline study and review
platform for the **Philippine Electronics Engineering (ECE) Board Exam**.
ECEngine Companion is a **read-only** mirror of a desktop ECEngine question
bank — designed to be carried in your pocket for review sessions when you're
away from the desktop, not to replace it.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Capacitor 8**.

---

## 🌟 Key Features

### 🎴 Flashcards & Formula Study System
- **Interactive 3D Study Card**: Smooth flip animation with KaTeX math formula rendering, diagram zooming, and dynamic content-aware height expansion.
- **AutoFitText Dynamic Math Scaling**: Real-time DOM width measurement that automatically scales wide KaTeX equations and formula derivations to fit mobile card widths without horizontal clipping.
- **Formula Study Mode**: First-class formula deck review supporting LaTeX equations (`$$latex$$`), variable definitions (`$key$: value`), front diagrams (`imagePathFront`), and step-by-step solution derivations.
- **Pinch-to-Zoom Gesture**: Native 2-finger touch scaling ($0.75\times$ to $3.0\times$) on card text, with auto-reset on flip/advance and double-tap reset.
- **Landscape-Optimized Layout**: Wide horizontal presentation (`landscape:max-w-4xl`) with tailored font scaling and height adjustments for landscape studying.
- **Zero-Latency Pipelined Text-to-Speech (TTS)**: Custom singleton streaming pipeline that plays Sentence 1 in under 200ms using native `QUEUE_FLUSH` while background-synthesizing subsequent sentences with `QUEUE_ADD`. Automatically suppresses raw LaTeX in formulas, preserves engineering decimals (`12.5 V`, `0.7 mA`) and technical abbreviations (`fig.`, `approx.`, `e.g.`), and cancels immediately on card flip, navigation, screen lock, or app backgrounding.
- **Pre-Launch Settings Modal**: Context-aware modal to configure card shuffling, Term ↔ Definition (or Name ↔ Formula) swap, bookmark filtering, and TTS.
- **AI Context & Explanations**: One-tap prompt generator (`Get Context`) with native Android clipboard integration for external LLMs (ChatGPT, Gemini, Claude), plus in-app AI explanation panels with desktop-parity markdown formatting, terminal styling (Orbitron + JetBrains Mono), numbered list segmentation, callout blocks, and robust inline KaTeX math rendering.

### 📚 LooksFam / Learn Mode
- **Multiple-Choice Question Drills**: Instant feedback and choice scrambling to eliminate positional memory bias. Positioned as the primary, leftmost tab for immediate drilling.
- **Pipelined Audio Read-Aloud**: Instant question narration with sentence streaming, math symbol normalization (`Ω` → "ohms", `μ` → "micro", `√` → "square root of"), and automatic silence on answer selection, navigation, or phone screen lock.
- **Sound Effects & Smooth Transitions**: Correct/wrong/round-complete audio feedback with framer-motion question fade transitions and ghost-highlight protection.
- **Full Solution Breakdowns**: KaTeX-rendered mathematical derivations, step-by-step explanations, callout boxes, and interactive diagram lightboxes.
- **Active Partition Queue**: Missed questions automatically requeue until 100% mastery is reached for the session.
- **Pre-Launch Configuration**: Custom question count, random sampling, choice shuffling, and bookmark filtering.

### 🎮 Gauntlet Arcade Mode (Survival & Time Trial)
- **High-Stakes Survival Challenge**:
  - Configurable lives (3, 5, or Unlimited) and per-question timers (30s, 1m, 2m, or Unlimited).
  - Dynamic difficulty ramp that gradually targets heavier questions as streak climbs.
  - **Survival Life Bonus Milestones**:
    - **10-Streak Bonus**: +1 Life on every 10 consecutive correct answers.
    - **20-Correct Bonus**: +1 Life on every 20 total correct answers.
    - **Dual Hit**: +2 Lives awarded simultaneously when both milestones align.
    - Dynamic life recovery toasts, sound effects, and low-health music alert resets.
- **Time Trial Sprint**:
  - Global countdown timer (5m, 10m, 25m, 1 hr) with real-time progress bar, urgency shake animations, and pace feedback.
- **Skips System & Skip Credits**:
  - Starts with 1 banked skip credit; earns +1 skip credit for every 20 consecutive correct streak.
  - Consuming a skip passes the question without penalty and **preserves current streak**.
- **3-2-1-GO! Countdown Splash Screen**:
  - Animated pre-round countdown with Web Audio synthesized tick/go tones and audio prewarming for seamless playback from question #1.
- **Dynamic Adaptive Background Music**:
  - Responsive soundtrack adapting to gameplay states (`stealth` countdown $\rightarrow$ `enemiesNearby` / `battle1` $\rightarrow$ `combatOver` victory/gameover), with low-health warning loops and native screen-lock pause/resume handling.
- **Comprehensive Post-Run Answer Review**:
  - Filter tabs matching desktop: **All**, **Wrong**, **Skip/Time**, and **Correct**.
  - Metric chips: Sequence `#`, Subject color tag, TOS Code or Deck Folder name, Outcome badge (`CheckCircle2`, `XCircle`, `SkipForward`, `Timer`).
  - Comparative answers (`D → C` or `A`), timing, and pace markers (`TOO FAST`, `SLOW`, `+STREAK`).
  - Tap-to-expand accordion with full LaTeX question rendering, image diagrams, color-coded choice breakdown, and complete solution explanations.
  - **One-Tap Re-drilling**: Direct `LEARN MISSED` and `LEARN ALL` transitions into LooksFam drills, plus `RUN IT BACK` reshuffled instant rematches.

### 📝 Test Mode & Test Paper View
- **Timed Exam Simulation**: Real-time countdown timer, question status navigation rail, choice scrambling, audio cues, and flagging.
- **Performance Summary**: Score calculation, time spent, and accuracy breakdown.
- **Test Paper View**: Continuous, printable-style document viewer matching desktop typography with Rajdhani font, JetBrains Mono formula blocks, and mobile-optimized question/choice scaling (Table, Glossary/List, and Q&A layouts with Light, Sepia, and Dark themes) — display-only (no export/print/share; see Design Philosophy below).

### 🗂️ Topic Browser, ToS Topics & Subject Filtering
- **Progressive Batch Rendering & Virtualization**: Progressive batching (24 cards per slice) via `IntersectionObserver` eliminating DOM freeze and layout lag across 160+ decks.
- **In-Memory Query Caching**: SQLite deck counts and metadata cached in-memory with automatic invalidation on new database import.
- **View Preservation**: Preserves Topic Browser DOM and scroll position across study sessions for instant (<50ms) zero-reloading navigation.
- **Segmented Mode Toggle — Custom Decks | ToS Topics**: A toggle at the top of the Topic Browser switches between the standard Custom Decks view and the new **ToS Topics** panel:
  - **ToS Topics Panel**: Hierarchical folder sidebar (`TosTopicDrawer`) organized by subject → parent topic (`x.0`) → decimal subtopic (`x.x`). Selecting any topic launches a LooksFam drill scoped to that PRC syllabus classification. Card counts and mastery percentages per topic are aggregated live from `dbService.getTosTopicStats()`.
  - **Scope**: ToS Topic sessions include **all MCQ cards** tagged with the selected `tos_topic_id` (problem-solving cards included). No Gauntlet-style exclusion filtering is applied; the full card pool under each syllabus code is available for study.
Instant filtering across the 4 Philippine ECE Board Exam subject areas:
- **MATH (Mathematics — 7 Topics)**:
  - 1.0 Differential Calculus
  - 2.0 Integral Calculus
  - 3.0 Differential Equation
  - 4.0 Advanced Engineering Mathematics for ECE
  - 5.0 Engineering Data Analysis
  - 6.0 Electromagnetics
  - 7.0 Signals, Spectra & Signal Processing
- **ELECS (Electronics Engineering — 9 Topics)**:
  - 1.0 DC Electrical Circuits
  - 2.0 AC Electrical Circuits
  - 3.0 Electromagnetics
  - 4.0 Electronic Devices and Circuits
  - 5.0 Electronic Circuit Analysis and Design
  - 6.0 Electronic Systems and Design
  - 7.0 Logic Circuits and Switching Theory
  - 8.0 Microprocessor and Microcontroller Systems
  - 9.0 Feedback and Control Systems
- **GEAS (General Engineering and Applied Sciences — 11 Topics)**:
  - 1.0 Chemistry for Engineers
  - 2.0 Physics for Engineers
  - 3.0 Engineering Economics
  - 4.0 Engineering Management
  - 5.0 Technopreneurship 101
  - 6.0 Physics 2
  - 7.0 Materials Science and Engineering
  - 8.0 Computer Programming
  - 9.0 Environment Science and Engineering
  - 10.0 ECE Laws, Contracts, Ethics, Standards and Safety
  - 11.0 CAD
- **EST (Electronics Systems & Technologies — 6 Topics)**:
  - 1.0 Signals, Spectra, Signal Processing
  - 2.0 Principles of Communications
  - 3.0 Digital Communications
  - 4.0 Transmission and Antenna Systems
  - 5.0 Electronics 3: Electronic Systems and Design
  - 6.0 Data Communications

Supports MCQ, Flashcard, Formula, and Mixed deck types, with live per-subject deck counts.

### 📦 Database & Asset Portability
- **Offline SQLite Engine**: Imports `.db`/`.sqlite` snapshots exported from desktop ECEngine, via `@capacitor-community/sqlite`. The import is a one-way copy — the companion never connects back to or modifies the desktop database.
- **Unpacked Image Bundles**: Zip archive extraction and filesystem resolution for question, answer, and explanation diagrams, via `@capacitor/filesystem`.
- **Native Android Clipboard**: `@capacitor/clipboard` with multi-tier fallbacks for reliable prompt copying across Android versions.
- **Multi-Provider AI Settings**: Local storage of your own API key for Google Gemini, Anthropic Claude, OpenAI, or a custom OpenAI-compatible endpoint — used only for the optional AI Explain feature.
- **Native Plugin Patching**: Managed via `patch-package` to persist native Android optimizations (such as TTS locale caching and promise-safe stop lifecycle handling) deterministically across builds.

---

## 🎯 Design Philosophy: What's Not Here, and Why

ECEngine Companion is intentionally a **subset** of desktop ECEngine, not a
port of everything. The guiding rule: if a feature exists to *author* or
*manage* content, it stays on desktop, where the full toolset lives. If it
exists to *review* content on the go, it belongs here.

- **No Dashboard.** The desktop dashboard is an overview/management surface.
  On a phone, you already know what you're about to review — jumping straight
  into the topic browser is faster than a landing page you'd swipe past every time.

- **No Add/Edit Deck.** Content authoring requires the full desktop toolset
  (validation, bulk editing, asset management). Building even a partial editor
  on mobile would create two divergent copies of the same content with no
  reliable way to reconcile them. The companion is a consumer of the desktop
  database, not a second source of truth for it.

- **No write-Settings / no database writes, period.** The companion opens the
  imported SQLite file strictly read-only. This isn't a missing feature — it's
  a deliberate constraint. The database is a snapshot exported from desktop;
  writing to it on-device would risk corrupting that snapshot or creating
  content drift between the phone and the desktop original, with no
  synchronization path to resolve it.

- **No PDF export/print/share.** Test Paper View exists so you can *read* a
  deck in a clean, continuous layout on your phone — printing and exporting
  are desktop-native workflows where you already have a keyboard, a printer
  driver, and file management. Duplicating that pipeline on Android added
  complexity for a workflow that doesn't fit the "phone in your pocket" use case.

- **No spaced-repetition (SM-2) scheduling.** Desktop ECEngine's mastery
  tracking is tied to the writable database. Since the companion is read-only,
  building a *separate* progress-tracking system on the phone would produce a
  second, disconnected notion of "mastery" that could contradict what desktop
  says — worse than not having it at all. Session-level progress (current run's
  score, missed-question requeueing) is supported; persistent cross-session
  mastery state is not.

- **No dedicated "Browse Bookmarks" screen.** Bookmarks are used for filtering
  *within* a study session ("bookmarked only" in Learn/Test/Flashcard settings),
  not as a separate library to browse. This matched actual usage patterns
  closely enough that a standalone screen wasn't worth the added navigation.

- **No MCQ-as-flashcard learning.** This was tried and reverted. Converting an
  MCQ card into a flashcard-style front/back isn't a free transformation — it
  needs a real conversion layer and settings plumbing, not just a toggle that
  changes which topics appear in a list. Rather than ship a half-working
  version, it was pulled out until it can be built properly.

In short: the companion trusts the desktop app to be the place where content
is created and long-term progress is tracked, and focuses entirely on making
review — reading, drilling, and testing — fast and pleasant on a phone.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/), [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Typography & Fonts** | [JetBrains Mono](https://www.jetbrains.com/lp/mono/), [Rajdhani](https://fonts.google.com/specimen/Rajdhani), [Orbitron](https://fonts.google.com/specimen/Orbitron) (100% offline self-hosted `@font-face`) |
| **Animation & Icons** | [Framer Motion 11](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Math Rendering** | [KaTeX 0.16](https://katex.org/) (with inline math delimiter guards & Prose fallback) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android API 24–36, target SDK 36) |
| **Plugins & Native APIs** | `@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/clipboard`, `@capacitor-community/text-to-speech` (patched for locale caching & promise-safe lifecycle), `@capacitor/preferences`, `@capawesome/capacitor-file-picker`, `@capacitor/app` |
| **Asset Generation** | `@capacitor/assets` |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/), ESLint, Gradle 8.13, [patch-package](https://www.npmjs.com/package/patch-package) |

---

## 📁 Project Structure

```
ecengine_companion/
├── android/                          # Capacitor Android native project (Gradle)
│   ├── app/src/main/res/             # Native resources, mipmap launcher icons, adaptive XML
│   └── variables.gradle              # Android SDK configuration (minSdk 24, targetSdk 36)
├── assets/                           # Source icons for @capacitor/assets generation
├── patches/                          # Reproducible native plugin patches via patch-package
│   └── @capacitor-community+text-to-speech+8.0.2.patch
├── reference/                        # Desktop reference files (read-only, used to port behavior/assets)
├── src/
│   ├── assets/
│   │   ├── images/                   # Native ECEngine logo & UI branding
│   │   ├── fonts/                    # Self-hosted brand fonts (Orbitron, JetBrains Mono, Rajdhani)
│   │   └── sounds/                   # Audio feedback assets
│   ├── components/
│   │   ├── gauntlet/                 # Gauntlet Arcade components
│   │   │   ├── GauntletArcadeHome.tsx# Config & mode setup (Survival vs Time Trial)
│   │   │   ├── GauntletCountdown.tsx # 3-2-1-GO! splash overlay with synthesized audio
│   │   │   └── GauntletSummaryModal.tsx # Full answer review, outcome filters & mastery
│   │   ├── AutoFitText.tsx           # Real-time DOM width math & KaTeX auto-fit scaler
│   │   ├── ExplanationPanel.tsx      # LooksFam AI explanation bottom sheet
│   │   ├── FlashcardContextPanel.tsx # Flashcard AI breakdown panel
│   │   ├── FlashcardSettingsModal.tsx# Pre-launch modal (Flashcards & Formulas)
│   │   ├── ImageLightbox.tsx         # Pinch/pan full-screen diagram viewer
│   │   ├── LearnSettingsModal.tsx    # Pre-launch LooksFam MCQ configuration
│   │   ├── LeaveConfirmModal.tsx     # Hardware/UI back navigation confirmation
│   │   ├── StudyCard.tsx             # 3D flip card with dynamic height & AutoFitText
│   │   ├── TestNavRail.tsx           # Exam question navigation drawer
│   │   ├── TestSettingsModal.tsx     # Pre-launch timed test configuration
│   │   └── TosTopicDrawer.tsx        # Hierarchical TOS subject → parent → subtopic folder sidebar
│   ├── hooks/
│   │   ├── useGauntletMusic.ts       # Adaptive background battle music state machine
│   │   ├── useSound.ts               # Sound effect playback & audio prewarming
│   │   └── useTTS.ts                 # React hook delegating to TTSService singleton
│   ├── lib/                          # Pure utility libraries (gauntlet, latex, subjectColors, sampling)
│   ├── pages/
│   │   ├── FlashcardSession.tsx      # Flashcard & Formula study runner
│   │   ├── GauntletSession.tsx       # Gauntlet arcade gameplay runner
│   │   ├── LearnSession.tsx          # LooksFam MCQ drill runner
│   │   ├── Settings.tsx              # Database import & AI key manager
│   │   ├── TestMode.tsx              # Timed exam simulation runner
│   │   ├── TestPaperView.tsx         # Printable-style continuous deck view
│   │   └── TopicBrowser.tsx          # Main subject & topic explorer (Custom Decks | ToS Topics toggle)
│   ├── services/
│   │   ├── bookmark.service.ts       # MCQ bookmark manager (Preferences)
│   │   ├── clipboard.service.ts      # Native Android clipboard with fallback
│   │   ├── db.service.ts             # SQLite service: getCards, getCardsWithProgress, getAllCardsByTopic,
│   │   │                             #   getGauntletCards, getGauntletPoolSizes, getTosTopicStats,
│   │   │                             #   and virtual tos_* topic ID routing
│   │   ├── dbImport.service.ts       # File picker & database import
│   │   ├── explain.service.ts        # Multi-provider LLM API client
│   │   ├── flashcardBookmark.service.ts # Flashcard & Formula bookmark manager
│   │   ├── gauntlet-storage.service.ts # High scores & best streaks storage
│   │   ├── image.service.ts          # Unpacked image resolution
│   │   └── tts.service.ts            # Pipelined sentence streaming & cancellation TTS service
│   ├── types/                        # Shared TypeScript models (Card, MCQData, FlashcardData, FormulaData)
│   ├── App.tsx                       # Root state machine, background listeners & session router
│   ├── index.css                     # Font imports & Tailwind base
│   └── main.tsx                      # React DOM entrypoint
├── capacitor.config.ts               # Capacitor app identifier & web bundle target
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Development Setup

### Prerequisites

- **Node.js**: `18.x` or higher, and `npm`
- **Android Studio / Android SDK**: API Level 24+ (API 34–36 recommended)
- **Java Development Kit**: JDK 21

### Installation

```bash
git clone <repo-url>
cd ecengine_companion
npm install
```

> 💡 `npm install` automatically runs `patch-package` postinstall to apply native Android fixes to `@capacitor-community/text-to-speech`.

### Running the Web Dev Server

```bash
npm run dev
```

---

## 🔍 Verification & Android Build Sequence

Run this after making changes:

```bash
# 1. TypeScript type check (no emit)
npx tsc --noEmit

# 2. Build production web bundle
npm run build

# 3. Lint
npm run lint

# 4. Copy web assets to Android project
npx cap sync android

# 5. Build debug APK
cd android && ./gradlew assembleDebug

# 6. Deploy to connected Android device or emulator
npx cap run android
```

> ⚠️ `npx cap run android` packages whatever's already in `android/app/src/main/assets/public` — it does **not** rebuild the web bundle. Always run `npm run build` (and `npx cap sync android`) immediately before it, or you'll install a stale build with no error.

---

## 📱 Installing on a Physical Android Device

Debug APKs build to:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Via USB/ADB:**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Via direct transfer:** copy the APK to your phone (Drive, messaging, USB storage), open it from a file manager, and allow "Install unknown apps" when prompted.

---

## 🔒 Data & Privacy

All data — the imported question database, bookmarks, settings, and any AI
provider API key — stays on-device in local storage (`@capacitor/preferences`)
or the local SQLite file. Nothing is uploaded anywhere except the optional AI
Explain feature, which sends the specific card's content to whichever AI
provider you've configured with your own API key, entirely at your discretion.
