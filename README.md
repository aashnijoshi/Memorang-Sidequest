# Memorang Mini ⚡

A lightweight LLM eval harness built for Memorang using TypeScript. It lets you define datasets of test cases, create graders with custom rubrics, and run experiments where Claude fact-checks your expected outputs — all in a clean three-tab web app.

🎥 **[Watch the Loom walkthrough here](https://www.loom.com/share/0ed2e16d43504661908adf201f8187ba)**

**The project is live at:** https://memorang-sidequest.vercel.app/

---

## What it does

There's an important distinction in how this app works that I want to be upfront about:

**Claude isn't generating answers, it's fact-checking expected outputs.**

So if I have a dataset row like `"Top Gun" → "Tom Cruise"`, Claude isn't answering "who's in Top Gun?" It's evaluating: *is Tom Cruise actually in Top Gun?* That's a much more interesting use case for an eval harness — you're using the LLM to validate the quality of your own test data.

The flow looks like this:

```
Create dataset → Define graders → Run experiment
       ↓
Frontend sends {datasets, graders} to /api/grade
       ↓
Claude evaluates each (test case × grader) combination
       ↓
Returns {passed: boolean, reason: string} for each
       ↓
Results table shows pass/fail + reasoning
```

---

## Features

- **Datasets tab** — full CRUD for test case collections. Add rows, edit inline, delete, and add custom columns for extra context
- **Graders tab** — define evaluation logic with a name, description, rubric, and type (exact match, numeric tolerance, contains keyword, etc.)
- **Experiments tab** — select a dataset and one or more graders, hit run, and see a results table with pass/fail and a reason per row
- State persists across tab switches without any backend — just Zustand

---

## Tech stack

- **Next.js 14+** with App Router
- **TypeScript**
- **Zustand** for state management (way simpler than Redux for this use case)
- **shadcn/ui** + Tailwind CSS for components and styling
- **Vercel AI SDK** + `@ai-sdk/anthropic` for LLM calls
- **Zod** for structured, type-safe outputs from Claude

---

## Project structure

```
eval-harness-memorang/
├── app/
│   ├── api/grade/route.ts       # Server-side LLM grading endpoint
│   ├── dataset/page.tsx         # Dataset management tab
│   ├── graders/page.tsx         # Graders management tab
│   ├── experiments/page.tsx     # Run experiments tab
│   ├── layout.tsx               # Root layout with navigation
│   └── globals.css              # Design tokens + Tailwind styles
├── components/
│   ├── DatasetManager.tsx       # Dataset CRUD component
│   ├── Sidebar.tsx              # Navigation sidebar
│   └── ui/                      # shadcn components
├── hooks/
│   └── use-store.ts             # Zustand store
├── lib/
│   └── store.ts                 # Type exports and seed data
└── .env.local                   # API key (NOT in git)
```

---

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/aashnijoshi/Memorang-Sidequest.git
cd Memorang-Sidequest
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your Anthropic API key

Create a `.env.local` file in the root:

```
ANTHROPIC_API_KEY=your_key_here
```

The API key is never exposed to the browser — all LLM calls happen server-side via the `/api/grade` route.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're good to go.

---

## Example datasets included

**Physics tutorial** — SI units, Newton's second law, Ohm's law questions with correct expected outputs

**The Loom includes me creating 'Movies & actors'** — intentionally includes one wrong entry (`Oppenheimer → Brad Pitt`) to demonstrate how the IMDb Expert grader catches factual errors. This one isn't included when you clone the repo.

---

## Debugging journey

This project had some fun bugs worth documenting:

**Dataset CRUD was silently broken** — The `DatasetManager` component was importing the `Dataset` type from `@/lib/store` (where `createdAt` was typed as `Date`) but reading from the Zustand store in `@/hooks/use-store` (where `createdAt` was a `string`). The type mismatch caused silent failures with no visible errors. Fixed by aligning imports to use the Zustand store types consistently.

**Reason column wasn't rendering** — Turned out to be two separate issues: I'd run out of Anthropic API credits mid-testing, and after adding credits, the experiments component wasn't properly destructuring `result.reason`. Added a fallback (`|| 'No reason generated'`) and fixed the mapping.

**Browser-side Anthropic SDK error** — Accidentally created a `lib/llm-grader.ts` that tried to instantiate the Anthropic client in a client component. Deleted it. LLM calls only belong in API routes.

---

## AI tools used

- **ChatGPT** — initial planning and TypeScript learning questions
- **V0.dev** — generated the initial UI prototype from a detailed prompt
- **Cursor** — primary coding environment, inline debugging, feature additions
- **Claude (chat)** — complex debugging, understanding errors across files
- **Claude Code** — deep repo analysis, finding the type mismatch bug that wasn't obvious from the surface

One thing I learned: different AI tools have different strengths. Cursor is great for in-context coding, Claude Code is better for reasoning about the whole repo at once, and V0 is surprisingly good at generating clean UI from a well-written prompt.

---

## What I'd build next

- Async job queue for large datasets so the UI doesn't block
- Confidence scores instead of binary pass/fail, have Claude return a 0–1
  confidence value so you can set thresholds and catch borderline cases
- Export results to CSV
- Aggregate stats (pass rate per grader, trend over time)
