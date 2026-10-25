# Local Dev Sign-in Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** On this Mac (development builds against the local Supabase stack), the app never shows the sign-in screen: it signs straight into a local test account that is a founder, so every dev tool and the design panel are there. On the sign-in screen, the codeword `dev` typed as the email signs into that account. None of it exists in production builds or works against any database but the local one.

## Design (Alex, Oct 25, 2026: "make it so the versions that don't get pushed to the cloud do not have a login screen and have all the dev tools. just make a special codeword that bypasses everything")

- **The dev account:** email `dev@one-of-one.local`, a password kept only in `apps/web/.env.local` (written by `npm run supabase:env`, generated randomly the first time and reused after), confirmed, and `is_founder = true`. `npm run supabase:env` creates or updates it on the local stack through the stack's service-role key (read from `supabase status`, used only by the script, never written to any env file or the app).
- **Auto sign-in:** in `apps/web/proxy.ts`, when the request has no session and the bypass is enabled, the proxy signs in with the dev account's email and password through the same server client, which sets the session cookies on the response, then lets the request continue (a request for `/signin` is redirected to `/board` after the auto sign-in).
- **The codeword:** on `/signin`, when the bypass is enabled, submitting the email field with exactly `dev` (case-insensitive, trimmed) calls a dev-only route `POST /api/dev/signin` that signs in the dev account server-side and sets the cookies, then the screen goes to `/board`. The route answers 404 when the bypass is disabled.
- **When the bypass is enabled (all must hold):** `process.env.NODE_ENV !== "production"`; `DEV_AUTO_SIGNIN` is not `"0"`; the Supabase URL's host is `127.0.0.1` or `localhost`; `DEV_SIGNIN_PASSWORD` is set. One function, `devBypassEnabled()` in `apps/web/lib/supabase/dev-bypass.ts`, decides it; everything calls it.
- **Production:** the bypass code is behind `process.env.NODE_ENV !== "production"` at every call site so the bundler drops it; `scripts/check-prod.mjs` gains markers (`dev@one-of-one.local`, `DEV_SIGNIN_PASSWORD`, `/api/dev/signin`) that must be absent from every built file, and `/api/dev/signin` must be 404 in the production server.
- **Tests:** Playwright's web server env sets `DEV_AUTO_SIGNIN=0`, so every existing spec still exercises the real sign-in screen. One new spec starts nothing extra: it calls `devBypassEnabled` and the codeword route's handler logic through unit tests instead (Vitest, mocking env), plus the production check covers absence. A manual check: `npm run dev` then opening http://localhost:3000 lands on the Board signed in, and the design panel shows on a saved card.

## Global Constraints

- Work from `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/dev-bypass` (branch `worktree-dev-bypass`); never touch `/Users/alex/Desktop/one-of-one-handoff` itself. `npm install --no-audit --no-fund` once; the local stack is running.
- No secret enters the repo or the browser: the dev password lives in the git-ignored `.env.local`, the service-role key only in the script's memory. Nothing in this plan may run against the hosted project.
- CLAUDE.md's Commands and "Where things are" get one line each describing the bypass and how to turn it off (`DEV_AUTO_SIGNIN=0 npm run dev`).
- Commit messages: a sentence of what and why, no prefixes, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: the whole feature

Files: `scripts/supabase-env.mjs`, `apps/web/lib/supabase/dev-bypass.ts` (+ `.test.ts`), `apps/web/proxy.ts`, `apps/web/app/api/dev/signin/route.ts`, `apps/web/app/signin/SignInScreen.tsx`, `playwright.config.ts`, `scripts/check-prod.mjs`, `CLAUDE.md`.

Steps: unit tests for `devBypassEnabled` first (each condition alone disables it; all together enable it); the env script creates/updates the dev user (admin API: create with `email_confirm: true`, or update its password when it exists) and sets `is_founder` via a REST update with the service key, and writes `DEV_SIGNIN_PASSWORD` into `.env.local` alongside the two public values, keeping an existing password; the proxy's auto sign-in; the codeword route and screen; Playwright's `DEV_AUTO_SIGNIN=0`; the production check's markers. Verify: `npm test`, `npm run lint`, `npm run typecheck`, `npx playwright test` (all green, the bypass off), `npm run check:prod` (markers absent, route 404), and a manual run of `npm run dev` with a Playwright script that opens `/board` with a fresh browser context and lands on the Board signed in without seeing `/signin`, then opens `/signin`, types `dev`, and lands on the Board.
