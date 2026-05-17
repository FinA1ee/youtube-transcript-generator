# YouTube Report Generator

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

## Commands

- `npm run dev`: run the Worker locally with Wrangler.
- `npm test`: run unit and e2e tests.
- `npm run test:unit`: run unit tests.
- `npm run test:e2e`: run e2e tests.
- `npm run typecheck`: run TypeScript checks.
- `npm run lint`: run ESLint.
- `npm run format`: check formatting.
- `npm run deploy`: deploy to Cloudflare.

## Behavior

- Supported URLs include `youtube.com/watch?v=...`, `youtu.be/...`, `/embed/...`, and `/shorts/...`.
- Captions must be available through TranscriptAPI.com. The app does not download or transcribe audio/video.
- TranscriptAPI is called only from the Worker backend with server-side Bearer-token authentication. Transcript fetching runs as a standalone request before report streaming starts.
- Gemini setup preflight runs as a standalone JSON request. The report stream is reserved for Gemini report-generation chunks.
- Auto-generated and manual captions are labeled in the English UI only when the transcript provider exposes that metadata.
- Videos longer than 100 minutes are rejected before Gemini generation.
- The transcript token budget is currently unknown and remains a documented implementation limit to tune later.
- The default Gemini model is `gemini-3-flash-preview`.
- Frontend model selection, report download/export, and durable resumable jobs are deferred capabilities.

## Quality Gates

Pull requests should pass:

```bash
npm run typecheck
npm run lint
npm run format
npm test
```

Commit messages should use concise imperative or conventional commit style, for example `feat: add transcript parser` or `Add transcript parser`.

CI runs install, typecheck, lint, format check, unit tests, and e2e tests. Cloudflare deployment is gated behind passing checks and required Cloudflare secrets.

## Security

Never commit API keys, cookies, OAuth tokens, downloaded private transcripts, Cloudflare credentials, Gemini keys, TranscriptAPI keys, transcript token secrets, `.dev.vars`, or `.env` files. Transcript text is held in request scope or signed short-lived handoff tokens only and should not be logged.
