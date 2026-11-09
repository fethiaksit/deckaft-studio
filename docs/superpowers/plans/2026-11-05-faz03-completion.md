# FAZ 03 Completion Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Traceable, persisted mobile profile cutting with honest stock-count optimality and material accounting.
**Architecture:** Pure bounded branch-and-bound seeded by BFD, independent cutting settings/model and invariant decoder; SQLite v3 source snapshot guards; responsive cutting route with member links.
**Tech Stack:** Existing TypeScript, Expo, React Native, SQLite, node:test, Jest.
**Spec:** `docs/superpowers/specs/2026-11-05-faz03-completion-request.md`

## Global Constraints
- Preserve FAZ 00–02, stock 6000 mm, kerf 3 mm defaults; never split unresolved splices.
- Separate steel/aluminium, width, height, wall; no fabrication approval from optimization.
- Work on feat/faz03-cutting-optimization; do not modify main or merge a PR; no FAZ 04.
- User authorized implementation, tests, commit, push and PR update without additional design approval.

## Review Focus
- Floating precision must never create a physically overfull stock.
- Empty, malformed, duplicated or huge inputs must not claim a usable complete plan.
- Source changes with identical timestamps must invalidate saved cutting results.
- Saving while source changes must fail atomically; stale inventory cannot be available.
- UI parameter changes, navigation and async generation must not expose an old plan as current.

### Task 1: Solver, rules and inventory model
Files: src/modules/cutting/{engine,model,solver}.ts; tests/cutting.test.ts
Interface: estimateCutting(plan, options?) returns stocks, bounds, optimizationStatus, classified residuals; source remains unapproved.
- [x] Write tests for 3000+3000, 2450+1800+1700, material/section/wall segregation, malformed inputs, trims, single/overlength/splice, mass balance, BFD counterexample, bounded fallback and independent brute-force oracle.
- [x] Run tests RED; implement bounded exact stock solver seeded by BFD, conservative integer micrometre rounding, explicit per-piece saw and trim rules, remnant classification.
- [x] Run domain tests GREEN and commit.

### Task 2: SQLite source linkage and validation
Files: src/modules/cutting/persistence.ts; src/core/db/{schema,repository}.ts; tests/{cutting-repository,framing-repository}.test.ts
Interface: getCutting(projectId), saveCutting(plan), listRemnants(projectId); latest cutting plan persisted with immutable sourceRevision and dynamic stale state.
- [x] Add RED real SQLite reopen/migration/source race/corruption/stale tests including same timestamp edits and drawing changes.
- [x] Implement v3 additive tables and source-conditional atomic writes; derived inventory persists via stored plan, queried with current source state.
- [x] Run persistence and regression tests GREEN and commit.

### Task 3: Mobile cutting workspace and member navigation
Files: src/screens/CuttingScreen.tsx; src/modules/cutting/{components,hooks}/; app/cutting/[id].tsx; framing hook/screen; module/project entry links.
Interface: cutting route id=projectId, memberId optional; framing route memberId selects and reveals member.
- [x] Add RED phone/tablet real-repository UI tests for generate/save/reopen, settings, stale blocking, member navigation and errors.
- [x] Implement horizontal colored bars, settings, separate exclusion list, stock quality summary, tablet split detail, highlighted source member preview and links.
- [x] Run UI tests GREEN and commit.

### Task 4: Verification, review and delivery
Files: README.md; docs/FAZ03-{STATUS,VERIFICATION}.md
- [x] Run check, format, Expo Doctor, Expo dependency check and iOS/Android export; inspect available simulators and phone/tablet screenshots when possible.
- [x] Review diff and fix material issues with regression tests; record exact limitations and test results.
- [ ] Commit, push feature branch, update PR #1 metadata; because PR #1 is already merged, open a follow-up PR if necessary to expose the new diff without merging.
