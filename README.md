# YouTube Report Generator

<img width="1359" height="770" alt="image" src="https://github.com/user-attachments/assets/794ff113-5308-47c2-8814-34566a2788bd" />

TypeScript full-stack app for generating a streamed Simplified Chinese report from a YouTube video that exposes captions. The backend is a Hono app deployed on Cloudflare Workers. The UI is English; generated report content is Simplified Chinese only.

## Requirements

- Node.js 22+
- Gemini AI Studio API key
- TranscriptAPI.com API key
- Cloudflare account and Wrangler credentials for deployment

## Setup

```bash
npm install
cp .env.example .dev.vars
```

Set `GEMINI_API_KEY`, `TRANSCRIPTAPI_KEY`, and `TRANSCRIPT_TOKEN_SECRET` in `.dev.vars` for local development. In Cloudflare, store all three values as Worker secrets. Use a long random value for `TRANSCRIPT_TOKEN_SECRET`; it signs short-lived transcript handoff tokens between transcript fetch and report streaming.

Set `ENABLE_DIAGNOSTIC_CONTROLS=true` only when you want the UI to show the standalone Gemini test control during local testing or dry runs. It is hidden by default.

## Commands

- `npm run dev`: run the Worker locally with Wrangler.
- `npm run build:client`: build the React/Vite/Tailwind browser bundle and embed it into `src/client/generated.ts`.
- `npm run build`: run the frontend build step.
- `npm test`: run unit and e2e tests.
- `npm run test:unit`: run unit tests.
- `npm run test:e2e`: run e2e tests.
- `npm run typecheck`: run TypeScript checks.
- `npm run lint`: run ESLint.
- `npm run format`: check formatting.
- `npm run deploy`: deploy to Cloudflare.

## Cloudflare Deployment

The Worker entrypoint is `src/worker/index.ts`, configured by `wrangler.toml`. Non-secret defaults are stored in `[vars]`: `GEMINI_MODEL=gemini-3-flash-preview` and `MAX_VIDEO_DURATION_MINUTES=100`.

Before deploying, configure these Cloudflare Worker secrets:

- `GEMINI_API_KEY`: Gemini AI Studio API key.
- `TRANSCRIPTAPI_KEY`: TranscriptAPI.com API key.
- `TRANSCRIPT_TOKEN_SECRET`: long random string used to sign transcript handoff tokens.

Wrangler also needs Cloudflare authentication. For local interactive use, run `npx wrangler login`. For CI or any non-interactive environment, create a Cloudflare API token and expose it as `CLOUDFLARE_API_TOKEN` before running Wrangler. Create the token from the Cloudflare dashboard under My Profile > API Tokens, then copy the token secret when Cloudflare shows it. Cloudflare only shows the token secret once.

For a local non-interactive shell:

```bash
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
npx wrangler deploy
```

Optional runtime variables:

- `ENABLE_DIAGNOSTIC_CONTROLS=true`: shows the Gemini test button in the UI.
- `MAX_TRANSCRIPT_SEGMENTS`: optional transcript truncation guard.
- `MAX_TRANSCRIPT_CHARACTERS`: optional transcript truncation guard.

Local deployment flow:

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run format
npm test
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put TRANSCRIPTAPI_KEY
npx wrangler secret put TRANSCRIPT_TOKEN_SECRET
npx wrangler deploy
```

GitHub Actions deployment requires repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The CI workflow installs dependencies, builds the React client, runs typecheck/lint/format/tests, then deploys through Wrangler on `main` or when manually dispatched with deploy enabled.

After deployment, use the exact URL printed by Wrangler. For Workers.dev it should look like:

```text
https://youtube-subscript-generator.<your-workers-subdomain>.workers.dev
```

Do not use `workers.dev://...`, the bare `https://workers.dev`, or `https://youtube-subscript-generator.workers.dev` unless Wrangler printed that exact URL. If the browser reports that `workers.dev` uses an unsupported protocol, first confirm that the copied URL starts with `https://` and includes the account Workers subdomain. The project sets `workers_dev = true` in `wrangler.toml`; if the URL still fails, check that the account Workers.dev subdomain is enabled in the Cloudflare dashboard.

## Behavior

- Supported URLs include `youtube.com/watch?v=...`, `youtu.be/...`, `/embed/...`, and `/shorts/...`.
- Captions must be available through TranscriptAPI.com. The app does not download or transcribe audio/video.
- TranscriptAPI is called only from the Worker backend with server-side Bearer-token authentication. Transcript fetching runs as a standalone request before report streaming starts.
- Gemini setup preflight runs as a standalone JSON request. The report stream is reserved for Gemini report-generation chunks.
- The frontend is a React/Vite bundle served by Hono. Report title, subtitle, headings, and summary paragraphs render incrementally with a typewriter effect while the POST SSE stream is active.
- The skip-animation control appears only during report generation/rendering, and the clear-content control resets the current report so a new link can be entered.
- Auto-generated and manual captions are labeled in the English UI only when the transcript provider exposes that metadata.
- Videos longer than 100 minutes are rejected before Gemini generation.
- The transcript token budget is currently unknown and remains a documented implementation limit to tune later.
- The default Gemini model is `gemini-3-flash-preview`.
- Frontend model selection, report download/export, and durable resumable jobs are deferred capabilities.

## Module Design

The code is split by responsibility so external service access, request handling, report generation, and UI rendering do not duplicate logic.

- `src/worker/index.ts`: Cloudflare Worker entrypoint. It creates the Hono app and exports the Worker handler.
- `src/server/app.ts`: HTTP route layer. It serves the app shell/assets and exposes standalone API routes for Gemini preflight, transcript fetch, and streamed report generation.
- `src/client/assets.ts`: Server-side static asset bridge. It serves the generated React bundle/styles and injects safe frontend configuration such as diagnostic-control visibility.
- `src/client/generated.ts`: Generated client bundle output from `npm run build:client`. Do not edit by hand.
- `src/client/react/`: React frontend source. It owns URL input, status display, diagnostic button gating, cancel/clear controls, SSE stream handling, and typewriter report rendering.
- `src/transcripts/`: TranscriptAPI integration. It fetches YouTube captions/transcripts, normalizes provider output, enforces transcript limits, and reports sanitized provider errors.
- `src/transcripts/token.ts`: Signed transcript handoff tokens. It lets transcript fetch stay separate from report streaming without exposing raw transcript state in the browser.
- `src/youtube/`: YouTube URL parsing and validation helpers.
- `src/llm/`: Gemini integration. It builds the English prompt, calls `@google/genai`, parses NDJSON report chunks, and validates streamable title/heading/paragraph events.
- `src/reports/`: Report orchestration. It connects transcript fetch, Gemini generation, retry/error state, stream event emission, and accumulated report structure.
- `src/shared/`: Shared TypeScript types and application error types used across backend, frontend, tests, and stream contracts.
- `tests/unit/`: Focused tests for parser, token, transcript, Gemini, pipeline, and URL behavior.
- `tests/e2e/`: Hono route and stream tests covering app shell/assets, standalone requests, transcript handoff, and report SSE output.

## Quality Gates

Pull requests should pass:

```bash
npm run build
npm run typecheck
npm run lint
npm run format
npm test
```

Commit messages should use concise imperative or conventional commit style, for example `feat: add transcript parser` or `Add transcript parser`.

CI runs install, typecheck, lint, format check, unit tests, and e2e tests. Cloudflare deployment is gated behind passing checks and required Cloudflare secrets.

## Security

Never commit API keys, cookies, OAuth tokens, downloaded private transcripts, Cloudflare credentials, Gemini keys, TranscriptAPI keys, transcript token secrets, `.dev.vars`, or `.env` files. Transcript text is held in request scope or signed short-lived handoff tokens only and should not be logged.
