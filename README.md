# ECEngine Companion

A mobile companion app for **ECEngine** — the offline study and review platform tailored for the **Philippine Electronics Engineering (ECE) Board Exam**.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Capacitor 8**, ECEngine Companion provides portable, offline-first access to question banks, flashcards, formulas, and timed exam simulations on Android phones, tablets, and emulators.

---

## 🌟 Key Features

### 🎴 Flashcards & Formula Study System
- **Interactive 3D Study Card**: Smooth flip animation with KaTeX math formula rendering, diagram zooming, and dynamic content-aware height expansion.
- **AutoFitText Dynamic Math Scaling**: Real-time DOM width measurement that automatically scales wide KaTeX equations and formula derivations to fit mobile card widths without horizontal clipping.
- **Formula Study Mode**: First-class formula deck review supporting LaTeX equations (`$$latex$$`), variable definitions (`$key$: value`), front diagrams (`imagePathFront`), and step-by-step solution derivations.
- **Pinch-to-Zoom Gesture**: Native 2-finger touch scaling ($0.75\times$ to $3.0\times$) on card text with auto-reset on flip/advance and double-tap reset.
- **Landscape-Optimized Layout**: Wide horizontal presentation (`landscape:max-w-4xl`) with tailored font scaling and height adjustments for landscape studying.
- **Text-to-Speech (TTS) Read Aloud**: Native Android voice synthesis automatically reads terms and definitions upon flipping (with automatic LaTeX suppression during formula study).
- **Pre-Launch Settings Modal**: Context-aware modal to configure card shuffling, Term $\leftrightarrow$ Definition (or Name $\leftrightarrow$ Formula) swap, bookmark filtering, and TTS.
- **AI Context & Explanations**: One-tap prompt generator (`Get Context`) with native Android clipboard integration for external LLMs (ChatGPT, Gemini, Claude) and in-app AI explanation panels.

### 📚 LooksFam / Learn Mode
- **Multiple-Choice Question Drills**: Instant feedback and choice scrambling to eliminate positional memory bias.
- **Sound Effects Engine**: Web Audio synthesizer with multi-tone feedback (correct chords, wrong buzzers, round fanfare, set complete) and audio sample fallback.
- **Full Solution Breakdowns**: KaTeX-rendered mathematical derivations, step-by-step explanations, and interactive diagram lightboxes.
- **Active Partition Queue**: Missed questions automatically requeue until 100% mastery is achieved.
- **Pre-Launch Configuration**: Custom question count, random sampling, choice shuffling, and bookmark filtering.

### 📝 Test Mode & Test Paper View
- **Timed Exam Simulation**: Real-time countdown timer, question status navigation rail, choice scrambling, audio cues, and flagging system.
- **Performance Summary**: Score calculation, time spent, accuracy breakdowns, and review recommendations.
- **Comprehensive Test Paper View**: Continuous printable-style document viewer supporting Table, Glossary/List, and Q&A layouts with Light, Sepia, and Dark themes. Optimized single-line mobile toolbar with answer/solution visibility toggles.

### 🗂️ Topic Browser & Subject Filtering
- **Board Exam Categorization**: Instant filtering across the 4 Philippine ECE Board Exam subjects:
  - **MATH**: Mathematics (Algebra, Trigonometry, Analytic Geometry, Calculus, Differential Equations, Advanced Math)
  - **ELECS**: Electronics Engineering (Semiconductors, Analog/Digital Circuits, Op-Amps, Power Electronics)
  - **GEAS**: General Engineering & Applied Sciences (Physics, Chemistry, Engineering Economy, Mechanics, Materials Science)
  - **EST**: Electronics Systems & Technologies (Communications, Transmission Lines, Antennas, Microwave, Satellite, Optical, Networking)
- **Deck Types**: Multi-mode support for MCQ (`mcq`), Flashcards (`flashcard`), Formulas (`formula`), and Mixed decks (`mixed`).
- **Clean Subject Pills**: Live deck count counters seamlessly styled to match subject color themes without visual background artifacts.

### 📦 Database & Asset Portability
- **Offline SQLite Engine**: Direct import of `.db` / `.sqlite` database snapshots exported from desktop ECEngine via `@capacitor-community/sqlite`.
- **Unpacked Image Bundles**: Zip archive extraction and filesystem resolution via `@capacitor/filesystem` for question, answer, and explanation diagrams.
- **Native Android Clipboard**: `@capacitor/clipboard` integration with multi-tier fallbacks guaranteeing reliable prompt copying on all Android devices.
- **Multi-Provider AI Settings**: Secure local storage of API keys for Google Gemini, Anthropic Claude, OpenAI, and custom OpenAI-compatible endpoints.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & UI** | [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/), [Tailwind CSS 3.4](https://tailwindcss.com/) |
| **Animation & Icons** | [Framer Motion 11](https://www.framer.com/motion/), [Lucide React](https://lucide.dev/) |
| **Math Rendering** | [KaTeX 0.16](https://katex.org/) (LaTeX formulas & math expressions) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android API 24–36, target SDK 36) |
| **Plugins & Native APIs** | `@capacitor-community/sqlite`, `@capacitor/filesystem`, `@capacitor/clipboard`, `@capacitor-community/text-to-speech`, `@capacitor/preferences`, `@capawesome/capacitor-file-picker`, `@capacitor/app` |
| **Asset Generation** | `@capacitor/assets` (automated legacy mipmap & adaptive icon generation) |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/), ESLint 10, Gradle 8.13 |

---

## 📁 Project Structure

```
ecengine_companion/
├── android/                         # Capacitor Android native project (Gradle)
│   ├── app/src/main/res/            # Native resources, mipmap launcher icons, adaptive XML
│   └── variables.gradle             # Android SDK configuration (minSdk 24, targetSdk 36)
├── assets/                          # Source icons for @capacitor/assets generation
├── reference/                       # Desktop reference files (read-only)
├── src/
│   ├── assets/                      # Bundled static assets
│   │   ├── images/                  # Native ECEngine logo & UI branding
│   │   └── sounds/                  # Audio fallback assets (wrong.wav)
│   ├── components/                  # Reusable UI components & modals
│   │   ├── AutoFitText.tsx          # Real-time DOM width math & KaTeX auto-fit scaler
│   │   ├── ExplanationPanel.tsx     # LooksFam AI explanation bottom sheet
│   │   ├── FlashcardContextPanel.tsx# Flashcard AI breakdown panel
│   │   ├── FlashcardSettingsModal.tsx# Context-aware pre-launch modal (Flashcards & Formulas)
│   │   ├── ImageLightbox.tsx        # Pinch/pan full-screen diagram viewer
│   │   ├── LearnSettingsModal.tsx   # Pre-launch LooksFam MCQ configuration
│   │   ├── LeaveConfirmModal.tsx    # Hardware/UI back navigation confirmation
│   │   ├── StudyCard.tsx            # 3D flip card with dynamic height & AutoFitText
│   │   ├── TestNavRail.tsx          # Exam question navigation drawer
│   │   └── TestSettingsModal.tsx    # Pre-launch timed test configuration
│   ├── hooks/                       # Custom React hooks
│   │   ├── useSound.ts              # Synthesized multi-tone & sample sound effects
│   │   └── useTTS.ts                # Android native Text-to-Speech synthesis
│   ├── lib/                         # Pure utility libraries (latex, subjectColors, sampling)
│   ├── pages/                       # Primary views
│   │   ├── FlashcardSession.tsx     # Flashcard & Formula study runner
│   │   ├── LearnSession.tsx         # LooksFam MCQ drill runner
│   │   ├── Settings.tsx             # Database, assets, and AI key manager
│   │   ├── TestMode.tsx             # Timed exam simulation runner
│   │   ├── TestPaperView.tsx        # Printable-style continuous deck view
│   │   └── TopicBrowser.tsx         # Main subject & topic explorer (MCQ/Flashcard/Formula tabs)
│   ├── services/                    # Native services & data access
│   │   ├── bookmark.service.ts      # MCQ bookmark manager (Preferences)
│   │   ├── clipboard.service.ts     # Native Android clipboard with multi-tier fallback
│   │   ├── db.service.ts            # SQLite database service
│   │   ├── dbImport.service.ts      # File picker & database migration
│   │   ├── explain.service.ts       # Multi-provider LLM API client
│   │   ├── flashcardBookmark.service.ts # Flashcard & Formula bookmark manager
│   │   └── image.service.ts         # Unpacked image resolution
│   ├── types/                       # Shared TypeScript models (Card, MCQData, FlashcardData, FormulaData)
│   ├── App.tsx                      # Root state machine & session router
│   ├── index.css                    # KaTeX font imports & Tailwind base
│   └── main.tsx                     # React DOM entrypoint
├── capacitor.config.ts              # Capacitor app identifier & web bundle target
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Development Setup

### Prerequisites

- **Node.js**: `18.x` or higher and `npm`
- **Android Studio / Android SDK**: API Level 24+ (API 34–36 recommended)
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

## 🔍 Verification & Android Build Sequence

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

# 5. Build debug APK
cd android && ./gradlew assembleDebug

# 6. Deploy to connected Android device or emulator
npx cap run android
```

> ⚠️ **Important Build Note**: `npx cap run android` packages existing assets in `android/app/src/main/assets/public`. Always ensure `npm run build` and `npx cap sync android` succeed before running `cap run android` or compiling Gradle APKs.

---

## 📱 Installing on a Physical Android Device

Debug APKs are built to:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Via USB / ADB:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Via Direct Transfer:
1. Transfer `app-debug.apk` to your phone via Google Drive, messaging, or USB storage.
2. Tap the APK file in your phone's File Manager.
3. Enable **"Install unknown apps"** when prompted, and proceed with installation.

---

## 🛡️ Standing Rules & Protected Architecture

- **Desktop Reference**: Always cross-reference desktop logic in `/home/delata/Shared/Projects/ecengine` before proposing mobile fixes.
- **Protected Files** (Never modify without explicit user instruction):
  - `src/lib/*`
  - `src/types/index.ts`
  - `reference/*`
  - `PORTED_FROM.md`
- **Read-Only Database Engine**: The mobile companion app strictly performs read queries on the imported SQLite snapshot and persists user progress, bookmarks, and settings via `@capacitor/preferences`.

---

## 📄 License

Private / Proprietary — Designed for Philippine Electronics Engineering (ECE) Board Exam preparation.
