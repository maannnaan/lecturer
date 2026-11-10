# Lecturer.bd

Every teacher gets their own website at `lecturer.bd/<handle>`, and a dashboard for their courses,
question bank, students and batches, live MCQ exams, question papers with uniquely shuffled sets and
OMR scanning, and payments.

| Folder | What |
|---|---|
| [`web/`](web/) | The website, dashboards and admin panel (Next.js + PostgreSQL). Start with [web/README.md](web/README.md). |
| [`design/phase0/`](design/phase0/) | The design review: three looks (Ink & Paper, Mist, Sage) that became the three teacher themes. Open `design/phase0/index.html`. |
| `scanner/` | The Lecturer.bd Scanner Android app (coming in a later phase). |
| [`qbank/`](qbank/) | QBank: a separate question-bank site (class › subject › chapter › CQ / MCQ / SQ / Board), Next.js + Tailwind with sample JSON data. Start with [qbank/README.md](qbank/README.md). |
| [`qbank-handoff/`](qbank-handoff/) | The approved QBank mockups and design notes that `qbank/` was built from. |
