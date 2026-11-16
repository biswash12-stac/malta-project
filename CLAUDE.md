# Malta project: Claude Code guide

Nepali grocery e-commerce site for a client in Malta. Customers order and pay cash on delivery (COD); the admin manages products and orders.

- `frontend/`: Next.js (App Router, TypeScript). Owned by the frontend developer. Its `AGENTS.md` is rewritten by `next dev`, so a diff there is usually generated, not someone's work.
- `backend/`: Express 5 + TypeScript, MongoDB/Mongoose (Atlas), Zod, Pino. Images go to Cloudinary as signed direct uploads. Owned by the backend developer.
- `documentV1/`: product, architecture, security and history documents.

Work only in the area the current user owns. Touch the other area only when they explicitly ask.

## Session start

Do these before any new work, and report what you find:

1. Run `git branch --show-current`, `git log --oneline -5` and `git status --short --untracked-files=all`. Sort the changes into committed, uncommitted and untracked, and work out which belong to the current task.
2. Read `backend/PROGRESS.md` → "Where We Are" and "Still To Do". That's the current state and the next tasks.
3. Read only the other documents the task needs (table below).
4. Where a document and the code disagree, the code and real test runs win. Then say which document is stale.
5. Name the latest unfinished task and recommend the next step. Reuse earlier findings and test evidence recorded in the documents. Re-investigate only when the code has changed since, or when the user asks.

The handoff below is a snapshot. Git and `PROGRESS.md` are the live truth.

## Where each fact lives

Each fact lives in one document. Update that one and link to it from others.

| Document | Owns |
|---|---|
| `backend/PROGRESS.md` | Current state, what's built, next tasks, pending client decisions, Known Limits |
| `documentV1/memory.md` | Project summary, key decisions with reasons (change log), handoff for a new session |
| `backend/API.md` | API contract: endpoints, response shapes, error codes, data lifecycle. The frontend developer relies on it |
| `documentV1/SECURITY_AUDIT.md` | Security findings and their status (§10), the production-readiness audit (§11) |
| `documentV1/SECURITY_IMPLEMENTATION_PLAN.md` | Approved security plans and their order |
| `documentV1/architecture.md` | Architecture, production configuration, and the launch and operations checklist (§8) |
| `documentV1/rules.md` | Engineering rules: naming, API conventions, security rules, git, definition of done |
| `documentV1/PRD.md`, `SRS.md`, `phases.md` | Agreed scope and phases. New features are change requests |
| `skills.md` (root) | Installed Claude Code plugins and skills. Update it after any install, change or removal |

Documentation files use CRLF line endings. Keep them: after editing, the number of `\r` characters equals the number of lines.

## Engineering rules

Follow `documentV1/rules.md`. On top of it:

- Priorities, in order: security, data integrity, maintainability.
- Controllers stay thin; business logic lives in services. Validate every input with Zod.
- Make focused changes for the task at hand, and leave unrelated working-tree changes exactly as they are.
- Report only evidence you produced: commands you ran and output you read. Say plainly what you didn't verify.
- Ask for explicit approval before every commit, push or merge, and show the staged diff first.
- For a confirmed defect, work test first. Write a failing test, check it fails for the right reason, then make the smallest fix.
- Separate confirmed defects (shown by code or a test) from theoretical risks. Check every review finding against the code before accepting it.

## Testing

Run commands from `backend/`. Tests use in-memory MongoDB and never touch Atlas, Gmail or Cloudinary.

- While implementing: run the affected test file (`node --import tsx --test tests/<file>.test.ts`).
- Before proposing a commit: `npm test`, `npm run test:jest`, `npx tsc --noEmit`, `npx prettier --check --end-of-line auto src tests`, `npm run build`, `npm audit --omit=dev`.
- Prettier needs `--end-of-line auto` on Windows. Some files are CRLF in this working copy, and a plain check reports them although CI (Linux) passes.
- For security and concurrency fixes, keep the regression tests, the race tests and a mutation check: temporarily disable the guard, see the test fail, then restore the source byte for byte.
- Verification is never cut to save tokens. Re-run a check only when something it covers has changed.

## Working efficiently

- Start from the documents and the files the task names, and widen only when needed.
- Reuse audits and reviews already recorded in `SECURITY_AUDIT.md` and `PROGRESS.md` instead of repeating them.
- Use subagents and `/code-review` when the user asks for them or a change is ready for review. One review per round of changes is enough.

## Working with the user

Act as a senior engineer and mentor:
- explain important trade-offs in plain language
- work on one task at a time
- give short progress updates, then a clear final summary (what changed, what was verified, what's still open)
- end with a recommended next step, and wait for approval before starting it.

## Handoff (as of 2026-11-16; verify with git first)

- Branch `feature/lifecycle-and-seed` is pushed and open as [PR #14](https://github.com/biswash12-stac/malta-project/pull/14) into `main`: **not merged, not deployed**. Commits: `34e2afb` (upload lifecycle, security fixes, dev seed), `e18e27a` (A-01, 2FA guess window), `97be2be` (docs), `deba14c` (Jest fixture fix: `SMTP_PORT`).
- CI passes on `deba14c` (run `43916518938`): backend type check, node:test 235/235, Jest 32/32; frontend lint and build. The first run failed because a Jest test relied on the local `backend/.env`; to reproduce CI locally, run Jest with `DOTENV_CONFIG_PATH=/nonexistent/.env`.
- A-01 is done except the separate test-client timeout task (`PROGRESS.md` → Still To Do → A-01 follow-up).
- Leave alone unless asked: the `frontend/AGENTS.md` change, `.archify/`, `.claude/settings.json`, `.vscode/`, and the untracked root reviews (`BACKEND_FRONTEND_GAP_ANALYSIS.md`, `FRONTEND_PROGRESS.md`, `UX_REVIEW.md`, `skills.md`).
- Next, in order, each needing approval: the merge decision on PR #14 → the A-07 and A-04 plans → the 2FA API feedback (agree the JSON with the frontend developer first).
- Pending elsewhere: client decisions and the production operations checklist (`PROGRESS.md`, `architecture.md` §8).
