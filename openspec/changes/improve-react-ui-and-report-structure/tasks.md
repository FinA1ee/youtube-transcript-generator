## 1. Frontend Build Setup

- [x] 1.1 Add React, Vite, Tailwind, and supporting frontend build dependencies.
- [x] 1.2 Add frontend build scripts and integrate built assets into Hono static serving.
- [x] 1.3 Create React client source structure with shared API/event types.
- [x] 1.4 Preserve Cloudflare Worker build and Wrangler dry-run compatibility.

## 2. Themed React UI

- [x] 2.1 Replace embedded vanilla client behavior with React components for form, toolbar, status, diagnostics, and report document.
- [x] 2.2 Implement a restrained theme with clear typography, spacing, controls, and responsive layout.
- [x] 2.3 Make status display visually prominent for transcript fetch, generation, retry, error, cancel, and completion states.
- [x] 2.4 Hide Gemini test controls unless diagnostic mode is enabled.
- [x] 2.5 Show skip-animation only while report generation/rendering is active.
- [x] 2.6 Add a clear-content/new-link button that closes active streams, clears report content, and focuses the URL input.

## 3. Hierarchical Report Model

- [x] 3.1 Extend shared stream/report types to support heading events with id, level, parentId, and text.
- [x] 3.2 Update report accumulation logic to preserve hierarchical heading order and associated paragraphs.
- [x] 3.3 Keep backward compatibility for existing title/section/paragraph events where practical during migration.

## 4. Gemini Prompt and Parser

- [x] 4.1 Update the Gemini prompt to request hierarchical NDJSON title, heading, and paragraph chunks.
- [x] 4.2 Update NDJSON parser to accept heading chunks with levels 1, 2, and 3.
- [x] 4.3 Validate or clamp invalid heading levels according to the chosen implementation policy.
- [x] 4.4 Map paragraph chunks to heading ids when provided.
- [x] 4.5 Add parser tests for h1/h2/h3 heading chunks, invalid levels, parent ids, and paragraph heading links.

## 5. Streamed Rendering

- [x] 5.1 Update React renderer to create title, subtitle, heading, and paragraph placeholders as events arrive.
- [x] 5.2 Apply typewriter rendering to title, subtitle, heading text, and paragraph text.
- [x] 5.3 Ensure queued stream content renders in order and skip-animation flushes all queued text.
- [x] 5.4 Ensure layout remains stable while streamed headings and titles are filling in.

## 6. Tests and Verification

- [x] 6.1 Add or update unit tests for report event accumulation and hierarchical report data.
- [x] 6.2 Add browser/UI tests or asset assertions for diagnostic gating, skip-animation visibility, clear-content behavior, and prominent status area.
- [x] 6.3 Add e2e tests for streamed title, heading, and paragraph rendering.
- [x] 6.4 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, frontend build, and Wrangler dry-run.
- [x] 6.5 Update README with frontend build/dev commands and diagnostic-control configuration.
