# ECEngine Companion

A mobile companion app for **ECEngine** — the offline study and review platform tailored for the **Philippine Electronics Engineering (ECE) Board Exam**.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Capacitor 8**, ECEngine Companion provides portable, offline-first access to question banks, flashcards, formulas, and timed exam simulations on mobile and tablet devices.

---

## Key Features

### 🎴 Flashcards Mode (Phase 1 Optimized)
- **Interactive 3D Study Card**: Smooth flip animation with KaTeX math formula rendering and diagram zoom.
- **Pinch-to-Zoom Gesture**: Native 2-finger touch scaling ($0.75\times$ to $3.0\times$) on card text with auto-reset on flip/advance and double-tap reset.
- **Landscape-Optimized Layout**: Wider horizontal layout (`landscape:max-w-4xl`) with tailored dynamic font scaling preventing vertical text clipping on short viewports.
- **Pre-Launch Settings Modal**: Configure card shuffling, Term $\leftrightarrow$ Definition swap, bookmark filtering, and native Text-to-Speech (TTS) read-aloud prior to launching the deck.
- **AI Context & Explanations**: One-tap structured prompt export (`Get Context`) for external LLMs (ChatGPT, Gemini, Claude) and in-app AI explanation panel.
- **Deck Actions**: Unified "Learn" session and "VIEW" printable test paper mode.

### 📚 LooksFam / Learn Mode
- **Multiple-Choice Question Drills**: Instant feedback and choice scrambling to eliminate positional memory bias.
- **Full Solution Breakdowns**: KaTeX-rendered mathematical derivations, step-by-step explanations, and interactive diagram lightboxes.
- **Active Partition Queue**: Missed questions automatically requeue until 100% mastery is achieved.
- **Pre-Launch Configuration**: Custom question count, random sampling, choice shuffling, and bookmark filtering.

### 📝 Test Mode & Test Paper View
- **Timed Exam Simulation**: Real-time countdown timer, question status navigation rail, and flagging system.
- **Performance Summary**: Score calculation, time spent, accuracy breakdowns, and review recommendations.
- **Comprehensive Test Paper View**: Continuous printable-style document viewer supporting Table, Glossary/List, and Q&A layouts with Light, Sepia, and Dark themes.

### 🗂️ Topic Browser & Subject Filtering
- **Board Exam Categorization**: Filter decks by the 4 Philippine ECE Board Exam subjects:
  - **MATH**: Mathematics (Algebra, Calculus, Differential Equations, Advanced Math)
  - **ELECS**: Electronics Engineering (Semiconductors, Analog/Digital Circuits, Op-Amps)
  - **GEAS**: General Engineering & Applied Sciences (Physics, Chemistry, Engineering Economy, Mechanics)
  - **EST**: Electronics Systems & Technologies (Communications, Transmission Lines, Antennas, Microwave, Networking)
- **Deck Types**: Multi-mode support for MCQ (`mcq`), Flashcards (`flashcard`), Formulas (`formula`), and Mixed decks (`mixed`).

### 📦 Database & Asset Portability
- **Read-Only SQLite Engine**: Direct import of `.db` / `.sqlite` database snapshots exported from desktop ECEngine.
- **Unpacked Image Bundles**: Zip archive extraction and filesystem resolution for question, answer, and explanation diagrams.
- **Multi-Provider AI Settings**: Store API keys for Google Gemini, Anthropic Claude, OpenAI, and local custom OpenAI-compatible endpoints.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/), [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Animation & Icons** | [Framer Motion](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Math Rendering** | [KaTeX 0.16](https://katex.org/) (LaTeX formulas & math expressions) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android API 34+) |
| **Plugins & Storage** | `@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor-community/text-to-speech`, `@capacitor/preferences`, `@capawesome/capacitor-file-picker`, `@capacitor/app` |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/), ESLint 9 |

---

## Project Structure

```
ecengine_companion/
├── android/                         # Capacitor Android native project
├── reference/                       # Desktop reference files (read-only)
├── src/
│   ├── components/                  # Reusable UI components & modals
│   │   ├── ExplanationPanel.tsx     # LooksFam AI explanation bottom sheet
│   │   ├── FlashcardContextPanel.tsx# Flashcard AI breakdown panel
│   │   ├── FlashcardSettingsModal.tsx# Pre-launch flashcard configuration
│   │   ├── ImageLightbox.tsx        # Pinch/pan full-screen diagram viewer
│   │   ├── LearnSettingsModal.tsx   # Pre-launch LooksFam MCQ configuration
│   │   ├── LeaveConfirmModal.tsx    # Hardware/UI back navigation confirm
│   │   ├── StudyCard.tsx            # 3D flip card with pinch-to-zoom & math
│   │   ├── TestNavRail.tsx          # Exam question navigation drawer
│   │   └── TestSettingsModal.tsx    # Pre-launch timed test configuration
│   ├── hooks/                       # Custom React hooks (useTTS, etc.)
│   ├── lib/                         # Pure utility libraries (latex, subjectColors, sampling)
│   ├── pages/                       # Primary views
│   │   ├── FlashcardSession.tsx     # Flashcard study runner
│   │   ├── LearnSession.tsx         # LooksFam MCQ drill runner
│   │   ├── Settings.tsx             # Database, assets, and AI key manager
│   │   ├── TestMode.tsx             # Timed exam simulation runner
│   │   ├── TestPaperView.tsx        # Printable-style deck view
│   │   └── TopicBrowser.tsx         # Main subject & topic explorer
│   ├── services/                    # Database, image resolution, bookmarks, AI APIs
│   ├── types/                       # Shared TypeScript models (Card, MCQData, FlashcardData)
│   ├── App.tsx                      # Root state machine & session router
│   ├── index.css                    # KaTeX font imports & Tailwind base
│   └── main.tsx                     # React DOM entrypoint
├── capacitor.config.ts              # Capacitor app identifier & web bundle target
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## Development Setup

### Prerequisites

- **Node.js**: `18.x` or higher and `npm`
- **Android Studio**: Android SDK (API Level 34+ recommended)
- **Java Development Kit**: JDK 21 (e.g. `JAVA_HOME=/home/delata/.jdks/jbr-21.0.11`)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ecengine_companion

# Install dependencies
npm install
```

### Running the Web Dev Server

```bash
npm run dev
```

---

## Verification & Android Build Sequence

Always execute this verification pipeline after making changes:

```bash
# 1. TypeScript type check (no emit)
npx tsc --noEmit

# 2. Build production web bundle (strict project references + Vite build)
npm run build

# 3. Code quality & lint check
npm run lint

# 4. Copy web assets to Android project
npx cap sync android

# 5. Deploy to connected Android device or emulator
npx cap run android
```

> ⚠️ **Important Build Note**: `npx cap run android` packages existing assets in `android/app/src/main/assets/public`. It does **not** recompile TypeScript sources automatically. Always verify that `npm run build` succeeds before running `cap sync` or `cap run`.

---

## Standing Rules & Protected Architecture

- **Desktop Reference**: Always cross-reference desktop logic in `/home/delata/Shared/Projects/ecengine` before proposing mobile fixes.
- **Protected Files** (Never modify without explicit user instruction):
  - `src/lib/*`
  - `src/types/index.ts`
  - `reference/*`
  - `PORTED_FROM.md`
- **Read-Only Database**: The mobile companion app does not mutate question data or topic tables in the imported SQLite snapshot.

---

## License

Private / Proprietary — Designed for Philippine Electronics Engineering Board Exam preparation.
