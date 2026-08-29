# Ported from ECEngine (desktop)

Source repo: /home/delata/Shared/Projects/ecengine
Source commit at copy time: d024be3dcb6bf8a5600360ae9ae026518623a057
Uncommitted changes present at copy time: 0

## Copied verbatim (src/lib/) — no Electron/DOM coupling, safe to use unmodified
- latex.ts — KaTeX rendering, currency/prose detection, pure string+regex logic
- subjectColors.ts
- constants.ts
- textUtils.ts
- scrambler.ts
- sampling.ts

NOT copied: sm2.ts — confirmed pure but out of scope (no SM-2 in companion app)

## Copied for reference only (reference/) — DO NOT import these directly
- PrintView.tsx.reference — contains MCQTableRow, MCQGlossaryItem, FormulaItem,
  ClickableImg, MathText sub-components defined INLINE in a 1645-line file.
  These need to be manually extracted into standalone components. The only
  non-portable piece is the "Export PDF" button/handler and the ece-app://
  image src scheme — everything else is presentational.
- db.service.ts.reference — method signatures to mirror in the new Capacitor
  SQLite adapter. Do not copy window.electron.* calls; reimplement each
  method against @capacitor-community/sqlite.
- tailwind.config.ts.reference — copy token values (colors, fontFamily,
  boxShadow, keyframes) into this project's own tailwind.config.ts.

## Types
- types/index.ts copied directly — Card, CardData, MCQData, FlashcardData,
  FormulaData, ConceptData, Progress, Topic, ExamSession are plain data
  interfaces, fully portable.
- types/window.d.ts NOT copied — that's the Electron IPC bridge type, has no
  meaning in a Capacitor app.

## Schema contract
Assumes ECEngine schema version 8 (see desktop repo's electron/db/database.ts
migration list as of the commit above). Re-verify column names against
desktop's schema.sql before assuming compatibility if schema changes later.

## Image handling
Desktop resolves images via a custom `ece-app://` protocol reading from
`config:getImagesPath` (default: userData/ece-images, overridable). The
companion app has no equivalent protocol — image paths from card.data
(imagePath, imageFront, imageBack, imagePathFront, solutionImagePath,
explanationImagePath) must be resolved via Capacitor Filesystem +
convertFileSrc() against a separately-exported images bundle (exported
independently from the DB snapshot, per project decision).
