## Why

The core transcript and streaming pipeline is now usable, but the current browser UI is too bare for repeated use and the report structure is too shallow for longer or more complex videos. This change improves presentation quality, workflow controls, and prompt/output shape while keeping the existing Hono/Cloudflare backend.

## What Changes

- Replace the embedded vanilla frontend with a React-based frontend bundle served by Hono.
- Use a coherent theme/design system for a more polished operational tool UI.
- Make status display more prominent and easier to scan.
- Hide the Gemini test button by default; show it only in configured test/dry-run mode.
- Show the skip-animation control only while report generation/rendering is active.
- Add a clear-content/new-link button that clears the current report and returns the form to a fresh input state.
- Update the Gemini prompt and stream chunk contract to support hierarchical report structure with multiple heading levels such as h1, h2, and h3.
- Stream titles and headings through the same incremental rendering path as paragraphs, instead of rendering them all at once.
- Preserve English UI text, Simplified Chinese report content, Hono backend, TranscriptAPI transcript flow, and POST streaming.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `report-html-rendering`: Improve UI quality with React/theming, clearer status, conditional controls, clear-content workflow, and typewriter rendering for title/headings.
- `gemini-report-generation`: Update the prompt/output structure to support hierarchical heading levels and richer structured summaries.
- `streaming-report-delivery`: Extend typed stream events/chunks so title and heading text can stream incrementally and include hierarchy level.

## Impact

- Adds frontend build tooling and React dependencies while keeping Hono as the server/runtime.
- Replaces `src/client/assets.ts` embedded script with generated/static frontend assets or a React bundle served by Hono.
- Updates report event types, NDJSON parser, prompt builder, frontend renderer, and tests.
- Requires UI-focused tests or asset assertions for conditional controls, clear workflow, status prominence, and streamed heading rendering.
