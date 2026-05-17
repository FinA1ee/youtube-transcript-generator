## Why

The current Gemini preflight is mixed into the report generation pipeline, so every report request performs a setup check before caption fetching. The project owner wants Gemini connectivity validation to be an explicit user action with visible SSE results, while normal report generation should stay focused on URL validation, caption acquisition, and report generation.

## What Changes

- Add a separate frontend button for testing whether the Gemini API call is valid.
- Add a dedicated backend SSE endpoint for Gemini preflight diagnostics.
- Stream preflight progress, success, and sanitized error results over SSE so the user can see the connection/test result.
- Remove automatic Gemini preflight execution from the report generation pipeline.
- Keep the existing tiny preflight prompt and no-user-content rule.
- Keep all UI copy in English and do not expose API keys, raw SDK/provider errors, request URLs, or stack traces.
- Preserve report generation behavior after submit, except it no longer performs a separate preflight step before caption fetching.

## Capabilities

### New Capabilities

- `gemini-preflight-diagnostics`: User-triggered Gemini setup diagnostics over SSE, independent from report generation.

### Modified Capabilities

- `gemini-report-generation`: Report generation should not run the Gemini preflight automatically as part of the report pipeline.
- `streaming-report-delivery`: Streaming delivery should expose a separate Gemini preflight SSE stream in addition to the report-generation SSE stream.
- `report-html-rendering`: The HTML UI should provide a separate Gemini test button and render streamed diagnostic results without mixing them into report rendering.

## Impact

- Updates `src/reports/pipeline.ts` to remove inline `geminiClient.preflight()` from normal report generation.
- Adds a dedicated route such as `GET /api/gemini/preflight/stream`.
- Reuses the existing Gemini client preflight method through a diagnostics pipeline or route-specific service.
- Updates browser UI assets to add the test button, diagnostic status region, and SSE lifecycle handling.
- Updates unit/e2e tests for separate preflight streaming and report pipeline ordering.
- Updates OpenSpec tasks/specs from the earlier preflight-in-pipeline design.
