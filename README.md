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
- **Text-to-Speech (TTS) Read Aloud**: Native Android voice synthesis reads terms and definitions on flip, with automatic LaTeX suppression during formula study.
- **Pre-Launch Settings Modal**: Context-aware modal to configure card shuffling, Term ↔ Definition (or Name ↔ Formula) swap, bookmark filtering, and TTS.
- **AI Context & Explanations**: One-tap prompt generator (`Get Context`) with native Android clipboard integration for external LLMs (ChatGPT, Gemini, Claude), plus in-app AI explanation panels using your own API key.

### 📚 LooksFam / Learn Mode
- **Multiple-Choice Question Drills**: Instant feedback and choice scrambling to eliminate positional memory bias.
- **Sound Effects**: Correct/wrong/round-complete audio feedback.
- **Full Solution Breakdowns**: KaTeX-rendered mathematical derivations, step-by-step explanations, and interactive diagram lightboxes.
- **Active Partition Queue**: Missed questions automatically requeue until 100% mastery is reached for the session.
- **Pre-Launch Configuration**: Custom question count, random sampling, choice shuffling, and bookmark filtering.

### 📝 Test Mode & Test Paper View
- **Timed Exam Simulation**: Real-time countdown timer, question status navigation rail, choice scrambling, audio cues, and flagging.
- **Performance Summary**: Score calculation, time spent, and accuracy breakdown.
- **Test Paper View**: Continuous, printable-style document viewer supporting Table, Glossary/List, and Q&A layouts with Light, Sepia, and Dark themes — display-only (no export/print/share; see Design Philosophy below).

### 🗂️ Topic Browser & Subject Filtering
Instant filtering across the 4 Philippine ECE Board Exam subjects:
- **MATH** — Algebra, Trigonometry, Analytic Geometry, Calculus, Differential Equations, Advanced Math
- **ELECS** — Semiconductors, Analog/Digital Circuits, Op-Amps, Power Electronics
- **GEAS** — Physics, Chemistry, Engineering Economy, Mechanics, Materials Science
- **EST** — Communications, Transmission Lines, Antennas, Microwave, Satellite, Optical, Networking

Supports MCQ, Flashcard, Formula, and Mixed deck types, with live per-subject deck counts.

### 📦 Database & Asset Portability
- **Offline SQLite Engine**: Imports `.db`/`.sqlite` snapshots exported from desktop ECEngine, via `@capacitor-community/sqlite`. The import is a one-way copy — the companion never connects back to or modifies the desktop database.
- **Unpacked Image Bundles**: Zip archive extraction and filesystem resolution for question, answer, and explanation diagrams, via `@capacitor/filesystem`.
- **Native Android Clipboard**: `@capacitor/clipboard` with multi-tier fallbacks for reliable prompt copying across Android versions.
- **Multi-Provider AI Settings**: Local storage of your own API key for Google Gemini, Anthropic Claude, OpenAI, or a custom OpenAI-compatible endpoint — used only for the optional AI Explain feature.

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
| **Animation & Icons** | [Framer Motion 11](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Math Rendering** | [KaTeX 0.16](https://katex.org/) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android API 24–36, target SDK 36) |
| **Plugins & Native APIs** | `@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/clipboard`, `@capacitor-community/text-to-speech`, `@capacitor/preferences`, `@capawesome/capacitor-file-picker`, `@capacitor/app` |
| **Asset Generation** | `@capacitor/assets` |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/), ESLint, Gradle 8.13 |

---

## 📁 Project Structure

```
ecengine_companion/
├── android/                          # Capacitor Android native project (Gradle)
│   ├── app/src/main/res/             # Native resources, mipmap launcher icons, adaptive XML
│   └── variables.gradle              # Android SDK configuration (minSdk 24, targetSdk 36)
├── assets/                           # Source icons for @capacitor/assets generation
├── reference/                        # Desktop reference files (read-only, used to port behavior/assets)
├── src/
│   ├── assets/
│   │   ├── images/                   # Native ECEngine logo & UI branding
│   │   ├── fonts/                    # Self-hosted brand fonts (Orbitron)
│   │   └── sounds/                   # Audio feedback assets
│   ├── components/
│   │   ├── AutoFitText.tsx           # Real-time DOM width math & KaTeX auto-fit scaler
│   │   ├── ExplanationPanel.tsx      # LooksFam AI explanation bottom sheet
│   │   ├── FlashcardContextPanel.tsx # Flashcard AI breakdown panel
│   │   ├── FlashcardSettingsModal.tsx# Pre-launch modal (Flashcards & Formulas)
│   │   ├── ImageLightbox.tsx         # Pinch/pan full-screen diagram viewer
│   │   ├── LearnSettingsModal.tsx    # Pre-launch LooksFam MCQ configuration
│   │   ├── LeaveConfirmModal.tsx     # Hardware/UI back navigation confirmation
│   │   ├── StudyCard.tsx             # 3D flip card with dynamic height & AutoFitText
│   │   ├── TestNavRail.tsx           # Exam question navigation drawer
│   │   └── TestSettingsModal.tsx     # Pre-launch timed test configuration
│   ├── hooks/
│   │   ├── useSound.ts               # Sound effect playback
│   │   └── useTTS.ts                 # Android native Text-to-Speech synthesis
│   ├── lib/                          # Pure utility libraries (latex, subjectColors, sampling)
│   ├── pages/
│   │   ├── FlashcardSession.tsx      # Flashcard & Formula study runner
│   │   ├── LearnSession.tsx          # LooksFam MCQ drill runner
│   │   ├── Settings.tsx              # Database import & AI key manager
│   │   ├── TestMode.tsx              # Timed exam simulation runner
│   │   ├── TestPaperView.tsx         # Printable-style continuous deck view
│   │   └── TopicBrowser.tsx          # Main subject & topic explorer
│   ├── services/
│   │   ├── bookmark.service.ts       # MCQ bookmark manager (Preferences)
│   │   ├── clipboard.service.ts      # Native Android clipboard with fallback
│   │   ├── db.service.ts             # SQLite database service (read-only)
│   │   ├── dbImport.service.ts       # File picker & database import
│   │   ├── explain.service.ts        # Multi-provider LLM API client
│   │   ├── flashcardBookmark.service.ts # Flashcard & Formula bookmark manager
│   │   └── image.service.ts          # Unpacked image resolution
│   ├── types/                        # Shared TypeScript models (Card, MCQData, FlashcardData, FormulaData)
│   ├── App.tsx                       # Root state machine & session router
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
