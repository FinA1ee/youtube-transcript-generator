## 1. Backend Diagnostics Stream

- [x] 1.1 Add focused tests proving `reportPipeline` no longer calls `geminiClient.preflight()` before caption fetching.
- [x] 1.2 Remove automatic `geminiClient.preflight()` from the report generation pipeline.
- [x] 1.3 Add typed Gemini preflight diagnostic stream events or reuse existing stream error/state types without introducing report-content events.
- [x] 1.4 Add a dedicated backend SSE route for Gemini preflight diagnostics, such as `GET /api/gemini/preflight/stream`.
- [x] 1.5 Ensure the preflight route creates a Gemini client from environment configuration and never accepts or sends a YouTube URL, caption segment, transcript, or report prompt.
- [x] 1.6 Ensure preflight success emits a terminal success event and preflight failure emits a sanitized terminal error event.
- [x] 1.7 Ensure client disconnect aborts the preflight call where supported.

## 2. Frontend Diagnostic UI

- [x] 2.1 Add an English Gemini test button to the app shell.
- [x] 2.2 Add a dedicated diagnostic status/notification region separate from the report content area.
- [x] 2.3 Implement browser SSE connection handling for the Gemini preflight stream.
- [x] 2.4 Disable or guard the Gemini test button while a diagnostic stream is active and restore it after success or error.
- [x] 2.5 Show English checking, success, and sanitized error notifications for Gemini preflight results.
- [x] 2.6 Preserve existing report content and report controls when the diagnostic stream succeeds or fails.

## 3. Tests and Verification

- [x] 3.1 Add backend or e2e coverage for successful Gemini preflight SSE output.
- [x] 3.2 Add backend or e2e coverage for failed Gemini preflight SSE output and sanitized user-visible error.
- [x] 3.3 Update existing report-stream tests that expected preflight failure before caption fetching.
- [x] 3.4 Add browser-side or asset-level assertions that preflight diagnostics do not create report title, section, paragraph, or caption elements.
- [x] 3.5 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and OpenSpec validation.
