## Context

The application currently has two related but different workflows:

1. Report generation: validate a YouTube URL, fetch captions, build transcript segments, call Gemini, and stream the Simplified Chinese report.
2. Gemini setup validation: send a tiny prompt to confirm the configured Gemini API key/model can be called.

The preflight validation was previously inserted into the report generation pipeline. That made diagnostics automatic, but it also caused every report generation request to call Gemini before any caption work. The owner now wants diagnostics to be user-triggered through a separate button, visible over its own SSE connection, and not mixed into report generation.

## Goals / Non-Goals

**Goals:**

- Add a separate English UI control for testing Gemini connectivity/setup.
- Stream Gemini preflight diagnostic progress and result over a dedicated SSE connection.
- Remove automatic preflight from the normal report pipeline.
- Keep the preflight prompt tiny and free of YouTube URL, caption segment, transcript, or report content.
- Show sanitized English success/error notifications for preflight results.
- Keep the report UI and diagnostic UI independent so diagnostic failures do not create empty report structure.
- Preserve existing Gemini SDK/client boundary and sanitized error mapping.

**Non-Goals:**

- Adding a full admin diagnostics dashboard.
- Running a real report-generation prompt during preflight.
- Testing YouTube caption availability from the preflight button.
- Storing diagnostic history.
- Exposing Gemini API keys, provider payloads, stack traces, or raw SDK errors.

## Decisions

### Add a dedicated Gemini preflight SSE endpoint

Add a route such as `GET /api/gemini/preflight/stream`. The route creates a Gemini client from Worker bindings/secrets, calls `geminiClient.preflight()`, and streams typed JSON events. It does not accept a YouTube URL and does not touch transcript or report modules.

Expected event flow:

```text
state: checking
complete: Gemini setup check succeeded
```

On failure:

```text
state: checking
error: sanitized Gemini setup failure
```

Alternatives considered:

- Reuse the report stream with a special query flag: rejected because it keeps diagnostics coupled to report generation routing.
- Use a non-streaming JSON endpoint: simpler, but the owner explicitly wants to see results in the SSE connection.

### Remove preflight from `reportPipeline`

The report pipeline should not call `geminiClient.preflight()` before caption fetching. It should call Gemini only when generating the report after transcripts are available. Missing/invalid Gemini configuration still surfaces as a provider error at generation time, but the explicit preflight button is the intended way to test setup before submitting a video.

Alternatives considered:

- Keep automatic preflight and add a separate button: rejected because the owner specifically wants preflight not mixed into the pipeline.
- Cache preflight success and use it during reports: out of scope and can create confusing stale diagnostics.

### Keep diagnostic events separate from report events

The preflight SSE stream can reuse the same low-level SSE serialization helper, but its event names and UI state should be distinct from report content events. A preflight failure should update a diagnostic status region and/or notification; it should not clear or mutate the report area.

Alternatives considered:

- Use the same client-side handler for both streams: possible, but more error-prone because report events include title, section, paragraph, and caption semantics.

### Keep UI copy English

The diagnostic button and status text should be English, consistent with the existing app chrome. Generated report content remains Simplified Chinese only; preflight diagnostic text is not report content.

## Risks / Trade-offs

- Users may skip diagnostics and still hit Gemini errors during report generation -> keep normal generation error handling intact.
- Separate SSE stream adds client state management -> keep it simple, allow only one active diagnostic stream at a time, and close it on completion/error/cancel.
- Preflight consumes a Gemini request -> keep the prompt tiny and only run when the user clicks the diagnostic button.
- Provider errors can contain sensitive details -> continue mapping through sanitized `AppError` messages.
- Two stream endpoints may duplicate serialization code -> reuse a small helper or shared event writer without coupling domain workflows.

## Migration Plan

1. Remove `geminiClient.preflight()` from `reportPipeline`.
2. Add a dedicated Gemini preflight SSE route/service.
3. Add frontend button and diagnostic status handling.
4. Update tests that previously expected preflight in report pipeline ordering.
5. Add e2e/backend coverage for diagnostic success and failure.
6. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, and OpenSpec validation.

## Open Questions

- Should the preflight button be disabled while report generation is active, or allowed to run independently?
- Should preflight have its own cancel button, or should completion/error be fast enough that a separate cancel control is unnecessary?
