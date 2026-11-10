# QBank — Design Handoff

A question bank website organized as **Class → Subject → Chapter → Question type (CQ / MCQ / SQ / Board)**.
The files in `design/` are the approved mockups. They are written in a design-tool format (`.dc.html`):
the markup and inline styles are the source of truth for layout and look, and the `<script type="text/x-dc">`
block at the bottom of each file shows the sample data and the interactions. Rebuild them in the project's
real stack — do not try to run the `.dc.html` files as-is (they need a runtime called `support.js` that isn't included).

## Pages

| File | Route (suggested) | Purpose |
|---|---|---|
| `design/Main.dc.html` | `/` | Home: search + class picker, question-type explainer, board/year shortcuts |
| `design/Class.dc.html` | `/class/[classId]` | Subjects for a class, tabbed by group (Common, Science, Business Studies, Humanities) |
| `design/Subject.dc.html` | `/class/[classId]/[subjectId]` | Chapter list with CQ / MCQ / SQ / Board counts per chapter |
| `design/Chapter.dc.html` | `/class/[classId]/[subjectId]/[chapterNo]?type=cq` | Questions for one chapter, tabbed by type, with filters |

## Design tokens

**Fonts** (Google Fonts): `Hind Siliguri` 400/500/600/700 for body (supports Bangla + Latin);
`Space Grotesk` 500/600/700 for headings and numbers.

**Colors**
| Token | Hex | Use |
|---|---|---|
| bg | `#F6F5F1` | page background |
| surface | `#FFFFFF` | cards, header |
| surface-alt | `#FAFAF7` | table/card header strips |
| ink | `#17191C` | text, dark buttons, footer |
| muted | `#4E535B` / `#5B6068` | secondary text |
| line | `#E3E1DA` (borders), `#EEECE6` (row dividers), `#D5D2C8` (input borders) |
| accent | `#0B6B4F` (hover `#08513C`), soft `#E3F1EA`, answer bg `#EEF6F2` |
| CQ | text `#1D4ED8` on `#E6EEFB` |
| MCQ | text `#0B6B4F` on `#E3F1EA` |
| SQ | text `#9A4A12` on `#FCEBDD` |
| Board | text `#6B5300` on `#FFF3CC`; CTA yellow `#F2B53A` |
| wrong | `#B4361F` on `#FCE8E4` |

**Shape & spacing**: radii 6 (tags), 8–10 (buttons/inputs), 12–16 (cards), 999 (pills).
Container `max-width: 1200px; padding: 0 24px`. Touch targets ≥ 44px. Card gap 16px.

## Layout rules
- Header: logo, nav (Classes, Subjects, Board Questions, Model Tests), language toggle, Sign in. Wraps on mobile.
- Breadcrumbs on every inner page.
- Chapter page: filter sidebar (`flex: 1 1 260px`) + main column (`flex: 999 1 560px`) in a wrapping row, so the sidebar stacks above the content on phones.
- Grids use `repeat(auto-fill, minmax(…, 1fr))` so they reflow.

## Interactions (Chapter page)
- Tabs CQ / MCQ / SQ / Board, with a count badge on each; sync the active tab to the `?type=` query param.
- **CQ**: stem box + parts a–d (Knowledge 1, Comprehension 2, Application 3, Higher ability 4 marks). "Show answers" reveals each part's model answer.
- **MCQ**: click an option → locks the question, marks correct ✓ (green) and the wrong pick ✗ (red), shows an explanation. Supports multi-statement (i/ii/iii) questions; preserve line breaks.
- **SQ**: per-question show/hide answer.
- **Board**: board filter chips + list rows (type badge, question, "Board · Year" tag, Open button → jumps to that question).
- "Show all / Hide all answers" toggle above the list.
- Filters: source checkboxes, board select, year select, difficulty radios, PDF download.

## Data model (suggested)
```ts
type QType = 'CQ' | 'MCQ' | 'SQ';
interface ClassLevel { id: string; name: string; groups: string[] }          // "9-10", "SSC"
interface Subject { id: string; classId: string; group: string; nameEn: string; nameBn: string; abbr: string }
interface Chapter { id: string; subjectId: string; no: number; titleEn: string; titleBn: string }
interface BoardTag { board: string; year: number }                         // Dhaka, Rajshahi, …
interface Question {
  id: string; chapterId: string; type: QType;
  difficulty?: 'easy' | 'medium' | 'hard';
  boards: BoardTag[];                                                       // empty = not a board question
  // CQ
  stem?: string; parts?: { key: 'a'|'b'|'c'|'d'; text: string; marks: number; level: string; answer: string }[];
  // MCQ
  text?: string; options?: string[]; correctIndex?: number; explanation?: string;
  // SQ
  answer?: string;
}
```
"Board questions" is a filter on `boards.length > 0`, not a separate table.

## Placeholder content
The brand name "QBank", the question counts and the board/year tags on the sample questions are placeholders.
The sample Physics questions are examples only.
