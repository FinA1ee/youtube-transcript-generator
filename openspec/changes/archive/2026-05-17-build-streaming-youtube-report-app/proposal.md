## Why

Users need a simple way to turn an existing YouTube video with subtitles into a readable, Simplified Chinese structured summary report without manually copying captions or waiting for a full backend job to finish before seeing progress. This change establishes the first full-stack TypeScript product slice for a Node.js-style web app that validates a YouTube link, extracts available subtitles, sends transcript content to Gemini AI Studio's free API, and streams the generated Simplified Chinese report into an HTML page, with Cloudflare used as the deployment target.

## What Changes

- Add a web UI where users submit a YouTube video URL that has subtitles or caption tracks.
- Add TypeScript backend routes using an edge-compatible Node.js framework, deployed on Cloudflare.
- Add an SSE endpoint for accepting a report generation request and streaming incremental generation events to the browser.
- Add transcript acquisition modules that resolve YouTube metadata, select a usable subtitle track, fetch caption data, and normalize it into speaker-aware transcript segments when possible.
- Add transcript support for both manually authored and auto-generated YouTube captions when caption tracks are exposed.
- Enforce strict TypeScript transcript/caption types with lint rules that prevent untyped transcript handling.
- Add a Gemini AI Studio client that uses the free API path, defaults to Gemini 3 Flash Preview via the official `gemini-3-flash-preview` model code, keeps credentials out of source code, and generates a structured Simplified Chinese report with title, subtitle, sections, and speaker-labeled summarized paragraphs.
- Add a lightweight Gemini setup preflight when the report SSE stream starts so API key, model, quota, and connectivity failures are detected before transcript content is sent, with sanitized user notification on failure.
- Add report rendering behavior that progressively displays streamed Simplified Chinese summary content in HTML as backend generation advances.
- Render streamed report content with a typewriter-style effect so users see content appear as stream events arrive instead of waiting for the complete report.
- Show titles and section headings immediately, typewriter-render paragraph content at a reasonable default speed, and provide a way to skip the animation.
- Show clear status notifications after submit, including validating input, fetching captions, generating the report, streaming content, reconnecting, complete, and error states.
- Add a cancel button that closes the active SSE connection and stops generation where possible.
- Add frontend notifications for videos with no usable subtitles so users understand what went wrong.
- Add SSE disconnected, reconnecting, retry, and failed-retry states in the frontend, preserving partial content after retry failure.
- Ensure final report paragraphs summarize transcript content instead of directly showing original transcript lines.
- Keep all application UI copy in English while generated report content is Simplified Chinese only.
- Add shared domain types and service boundaries so request handlers do not duplicate YouTube, transcript, Gemini, streaming, or rendering logic.
- Add commit rules and CI/CD checks so typecheck, lint, format, and tests pass before deployment.
- Add tests for URL validation, caption parsing, SSE report streaming, prompt construction, and important backend routes.

## Capabilities

### New Capabilities

- `youtube-input`: Validate and normalize user-submitted YouTube video URLs before report generation starts.
- `transcript-acquisition`: Discover, fetch, parse, and normalize manually authored or auto-generated YouTube subtitle/caption tracks into transcript segments.
- `gemini-report-generation`: Generate a structured Simplified Chinese summary report from transcript content through Gemini AI Studio's free API, using speaker-labeled paragraph summaries where useful.
- `streaming-report-delivery`: Stream generation progress and report content from the backend to the browser over SSE while work is still running, including disconnect and retry handling.
- `report-html-rendering`: Render the final and partial Simplified Chinese summary report in HTML with title, subtitle, sections, and speaker-labeled paragraph summaries.

### Modified Capabilities

None.

## Impact

- Adds a TypeScript application structure under `src/`, with a Hono backend app, a Cloudflare deployment adapter, and separate modules for `src/server/`, `src/worker/`, `src/youtube/`, `src/transcripts/`, `src/llm/`, `src/reports/`, and shared types.
- Adds browser-side code for the report form and streamed rendering, either as static Worker responses or assets served by the Worker.
- Adds environment configuration for the Gemini AI Studio API key, documented through `.env.example` and Worker secrets.
- Adds package scripts for local development, typechecking, unit tests, e2e tests, linting, formatting, commit validation, and deployment.
- Adds CI/CD workflow configuration for pull request checks and gated Cloudflare deployment.
- Adds unit and e2e test coverage under `tests/unit/` and `tests/e2e/`.
- Introduces third-party dependency risk around YouTube caption availability, SSE stream reliability, and Gemini API quota, rate limits, response format stability, setup preflight cost, and streaming support.
