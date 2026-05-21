## Why

The report stream currently owns too much work: it can run setup checks, fetch transcripts, and generate report content in one long-lived connection. Splitting preflight and transcript fetching into standalone HTTP requests makes failures easier to show before streaming starts and keeps the stream focused on the rendering phase only.

## What Changes

- Replace Gemini preflight SSE with a standalone server request that returns a JSON success or sanitized error result.
- Add a standalone transcript fetch request that accepts a YouTube URL, calls TranscriptAPI on the server, validates/normalizes the transcript, and returns a server-issued transcript reference for report generation.
- Keep TranscriptAPI credentials and raw provider payloads server-side.
- Change the report stream so it starts only after transcript fetch succeeds.
- Make the report stream responsible only for Gemini generation chunks and rendering events.
- Use a POST-based streaming endpoint if needed so the client can send the transcript reference in the request body; do not put large transcript data in a query string.
- Preserve English UI status messages, Simplified Chinese report content, cancel, retry, and typewriter rendering behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `gemini-preflight-diagnostics`: Preflight becomes a standalone JSON request instead of an SSE stream.
- `transcript-acquisition`: Transcript fetching becomes a standalone server request before report streaming.
- `streaming-report-delivery`: Report streaming starts from a fetched transcript reference and only streams report-generation/rendering events.
- `report-html-rendering`: UI flow changes to run preflight and transcript fetch as normal requests, then start rendering stream only after transcript readiness.

## Impact

- Adds or changes API routes for `/api/gemini/preflight`, `/api/transcripts/fetch`, and the report stream endpoint.
- Requires a safe way to pass fetched transcript data from the standalone transcript request to the report stream without exposing secrets or relying on fragile query strings.
- Updates browser flow and tests around setup diagnostics, transcript fetch errors, and report-stream startup.
- Removes preflight and transcript-fetch state events from the report SSE stream.
